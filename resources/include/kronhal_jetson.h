/*
 * kronhal_jetson.h  --  NVIDIA Jetson family HAL implementation
 *
 * Targets: jetson_nano, jetson_tx2, jetson_xavier_nx, jetson_agx_xavier,
 *          jetson_orin_nano, jetson_orin_nx, jetson_agx_orin
 *
 * GPIO: Linux GPIO character device ioctl (linux/gpio.h — no external library)
 *       All Jetson boards expose 40-pin header GPIO via /dev/gpiochip0.
 *       Use `gpioinfo /dev/gpiochip0` on the target to find line offsets.
 *
 * UART: Tegra High-Speed UART (ttyTHS*) — standard termios, no external lib
 * CAN:  SocketCAN (can0/can1) — raw AF_CAN socket, no external lib
 * I2C:  Linux I2C ioctl (/dev/i2c-N) — no external lib
 *
 * Static linking: all implementations use only Linux kernel interfaces and
 * POSIX syscalls — fully compatible with -static on aarch64-none-linux-gnu.
 *
 * Board-specific GPIO chip override (default /dev/gpiochip0):
 *   -DKRON_GPIO_CHIP="/dev/gpiochip2"   (if needed for your carrier board)
 */
#ifndef KRONHAL_JETSON_H
#define KRONHAL_JETSON_H

#include <linux/gpio.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <termios.h>
#include <errno.h>

#ifndef KRON_GPIO_CHIP
#define KRON_GPIO_CHIP "/dev/gpiochip0"
#endif

/* UART device nodes — Tegra High-Speed UART (ttyTHS) + standard ttyS */
#ifndef KRON_UART0
#define KRON_UART0 "/dev/ttyTHS0"
#endif
#ifndef KRON_UART1
#define KRON_UART1 "/dev/ttyTHS1"
#endif
#ifndef KRON_UART2
#define KRON_UART2 "/dev/ttyTHS2"
#endif
#ifndef KRON_UART3
#define KRON_UART3 "/dev/ttyTHS3"
#endif
#ifndef KRON_UART4
#define KRON_UART4 "/dev/ttyS0"
#endif
#ifndef KRON_UART5
#define KRON_UART5 "/dev/ttyS1"
#endif

/* CAN interface names */
#ifndef KRON_CAN0
#define KRON_CAN0 "can0"
#endif
#ifndef KRON_CAN1
#define KRON_CAN1 "can1"
#endif

/* I2C bus device nodes */
#ifndef KRON_I2C0
#define KRON_I2C0 "/dev/i2c-0"
#endif
#ifndef KRON_I2C1
#define KRON_I2C1 "/dev/i2c-1"
#endif
#ifndef KRON_I2C2
#define KRON_I2C2 "/dev/i2c-2"
#endif
#ifndef KRON_I2C3
#define KRON_I2C3 "/dev/i2c-3"
#endif

#define _JETSON_GPIO_MAX 512

#define _GPIO_DIR_NONE   0
#define _GPIO_DIR_INPUT  1
#define _GPIO_DIR_OUTPUT 2
#define _GPIO_DIR_ERROR  3

static int     _chip_fd              = -1;
static int     _line_fd[_JETSON_GPIO_MAX];
static uint8_t _gpio_dir[_JETSON_GPIO_MAX];
static int     _gpio_hal_ready       = 0;

/* CAN socket file descriptors (lazy-opened) */
static int _can_fd[2] = { -1, -1 };

/* UART file descriptors (lazy-opened) */
static int _uart_fd[6] = { -1, -1, -1, -1, -1, -1 };

/* I2C file descriptors (lazy-opened, one per bus) */
static int _i2c_fd[4] = { -1, -1, -1, -1 };

/* ---------------------------------------------------------------------------
 * HAL lifecycle
 * -------------------------------------------------------------------------*/

static inline void HAL_Init(void) {
    if (_gpio_hal_ready) return;
    for (int i = 0; i < _JETSON_GPIO_MAX; i++) {
        _line_fd[i] = -1;
        _gpio_dir[i] = _GPIO_DIR_NONE;
    }
    _chip_fd = open(KRON_GPIO_CHIP, O_RDWR);
    _gpio_hal_ready = 1;
}

static inline void HAL_Cleanup(void) {
    int i;
    for (i = 0; i < _JETSON_GPIO_MAX; i++) {
        if (_line_fd[i] >= 0) { close(_line_fd[i]); _line_fd[i] = -1; _gpio_dir[i] = _GPIO_DIR_NONE; }
    }
    if (_chip_fd >= 0) { close(_chip_fd); _chip_fd = -1; }
    for (i = 0; i < 2; i++) { if (_can_fd[i] >= 0) { close(_can_fd[i]); _can_fd[i] = -1; } }
    for (i = 0; i < 6; i++) { if (_uart_fd[i] >= 0) { close(_uart_fd[i]); _uart_fd[i] = -1; } }
    for (i = 0; i < 4; i++) { if (_i2c_fd[i] >= 0) { close(_i2c_fd[i]); _i2c_fd[i] = -1; } }
    _gpio_hal_ready = 0;
}

/* ---------------------------------------------------------------------------
 * GPIO internal helpers (identical to RPi HAL — same kernel interface)
 * -------------------------------------------------------------------------*/

static inline void _gpio_release_line(int pin) {
    if (_line_fd[pin] >= 0) { close(_line_fd[pin]); _line_fd[pin] = -1; _gpio_dir[pin] = _GPIO_DIR_NONE; }
}

static inline int _gpio_request_output(int pin) {
    if (_gpio_dir[pin] == _GPIO_DIR_OUTPUT) return 0;
    if (_gpio_dir[pin] == _GPIO_DIR_ERROR)  return -1;
    if (_chip_fd < 0) { _gpio_dir[pin] = _GPIO_DIR_ERROR; return -1; }

    _gpio_release_line(pin);

    struct gpiohandle_request req;
    memset(&req, 0, sizeof(req));
    req.lineoffsets[0] = (uint32_t)pin;
    req.flags = GPIOHANDLE_REQUEST_OUTPUT;
    req.default_values[0] = 0;
    strncpy(req.consumer_label, "kronplc", sizeof(req.consumer_label) - 1);
    req.lines = 1;

    if (ioctl(_chip_fd, GPIO_GET_LINEHANDLE_IOCTL, &req) < 0 || req.fd < 0) {
        _gpio_dir[pin] = _GPIO_DIR_ERROR; return -1;
    }
    _line_fd[pin] = req.fd;
    _gpio_dir[pin] = _GPIO_DIR_OUTPUT;
    return 0;
}

static inline int _gpio_request_input(int pin) {
    if (_gpio_dir[pin] == _GPIO_DIR_INPUT) return 0;
    if (_gpio_dir[pin] == _GPIO_DIR_ERROR) return -1;
    if (_chip_fd < 0) { _gpio_dir[pin] = _GPIO_DIR_ERROR; return -1; }

    _gpio_release_line(pin);

    struct gpiohandle_request req;
    memset(&req, 0, sizeof(req));
    req.lineoffsets[0] = (uint32_t)pin;
    req.flags = GPIOHANDLE_REQUEST_INPUT;
    req.default_values[0] = 0;
    strncpy(req.consumer_label, "kronplc", sizeof(req.consumer_label) - 1);
    req.lines = 1;

    if (ioctl(_chip_fd, GPIO_GET_LINEHANDLE_IOCTL, &req) < 0 || req.fd < 0) {
        _gpio_dir[pin] = _GPIO_DIR_ERROR; return -1;
    }
    _line_fd[pin] = req.fd;
    _gpio_dir[pin] = _GPIO_DIR_INPUT;
    return 0;
}

/* ---------------------------------------------------------------------------
 * GPIO Write
 * -------------------------------------------------------------------------*/

static inline void GPIO_Write_Call(GPIO_Write *inst) {
    inst->ENO = inst->EN;
    inst->OK  = false;
    if (!inst->EN) return;

    int pin = (int)inst->PIN;
    if (pin < 0 || pin >= _JETSON_GPIO_MAX) return;

    if (_gpio_request_output(pin) < 0) return;

    struct gpiohandle_data data;
    memset(&data, 0, sizeof(data));
    data.values[0] = inst->VALUE ? 1 : 0;
    inst->OK = (ioctl(_line_fd[pin], GPIOHANDLE_SET_LINE_VALUES_IOCTL, &data) == 0);
}

/* ---------------------------------------------------------------------------
 * GPIO Read
 * -------------------------------------------------------------------------*/

static inline void GPIO_Read_Call(GPIO_Read *inst) {
    inst->ENO   = inst->EN;
    inst->VALUE = false;
    if (!inst->EN) return;

    int pin = (int)inst->PIN;
    if (pin < 0 || pin >= _JETSON_GPIO_MAX) return;

    if (_gpio_request_input(pin) < 0) return;

    struct gpiohandle_data data;
    memset(&data, 0, sizeof(data));
    if (ioctl(_line_fd[pin], GPIOHANDLE_GET_LINE_VALUES_IOCTL, &data) == 0) {
        inst->VALUE = (bool)data.values[0];
    }
}

/* ---------------------------------------------------------------------------
 * GPIO SetMode  (MODE: 0 = input, 1 = output)
 * -------------------------------------------------------------------------*/

static inline void GPIO_SetMode_Call(GPIO_SetMode *inst) {
    inst->ENO = inst->EN;
    inst->OK  = false;
    if (!inst->EN) return;

    int pin = (int)inst->PIN;
    if (pin < 0 || pin >= _JETSON_GPIO_MAX) return;

    if (inst->MODE == 0)
        inst->OK = (_gpio_request_input(pin)  == 0);
    else
        inst->OK = (_gpio_request_output(pin) == 0);
}

/* ---------------------------------------------------------------------------
 * PWM  — sysfs PWM interface (/sys/class/pwm/pwmchipN)
 * -------------------------------------------------------------------------*/
static inline void HAL_PWM_Call(HAL_PWM *inst, uint8_t ch) {
    (void)ch;
    inst->ENO    = inst->EN;
    inst->ACTIVE = inst->EN;
    /* TODO: /sys/class/pwm/pwmchipN/pwmM sysfs */
}

/* ---------------------------------------------------------------------------
 * SPI  — Linux SPI device ioctl (/dev/spidevN.0)
 * -------------------------------------------------------------------------*/
static inline void HAL_SPI_Call(HAL_SPI *inst, uint8_t ch) {
    (void)ch;
    inst->ENO     = inst->EN;
    inst->RX_DATA = 0;
    inst->DONE    = inst->EN;
    /* TODO: /dev/spidevN.0 SPI_IOC_MESSAGE ioctl */
}

/* ---------------------------------------------------------------------------
 * I2C  — Linux I2C ioctl (/dev/i2c-N)
 * -------------------------------------------------------------------------*/
#include <linux/i2c-dev.h>

static const char * const _i2c_devs[4] = {
    KRON_I2C0, KRON_I2C1, KRON_I2C2, KRON_I2C3
};

static inline int _i2c_open(uint8_t ch) {
    if (ch >= 4) return -1;
    if (_i2c_fd[ch] < 0) {
        _i2c_fd[ch] = open(_i2c_devs[ch], O_RDWR);
    }
    return _i2c_fd[ch];
}

static inline void HAL_I2C_Read_Call(HAL_I2C_Read *inst, uint8_t ch) {
    inst->ENO  = inst->EN;
    inst->DATA = 0;
    inst->OK   = false;
    if (!inst->EN) return;

    int fd = _i2c_open(ch);
    if (fd < 0) return;

    if (ioctl(fd, I2C_SLAVE, (long)inst->ADDR) < 0) return;

    uint8_t reg = inst->REG;
    if (write(fd, &reg, 1) != 1) return;

    uint8_t buf = 0;
    if (read(fd, &buf, 1) == 1) {
        inst->DATA = buf;
        inst->OK   = true;
    }
}

static inline void HAL_I2C_Write_Call(HAL_I2C_Write *inst, uint8_t ch) {
    inst->ENO = inst->EN;
    inst->OK  = false;
    if (!inst->EN) return;

    int fd = _i2c_open(ch);
    if (fd < 0) return;

    if (ioctl(fd, I2C_SLAVE, (long)inst->ADDR) < 0) return;

    uint8_t buf[2] = { inst->REG, inst->DATA };
    inst->OK = (write(fd, buf, 2) == 2);
}

/* ---------------------------------------------------------------------------
 * UART  — Tegra High-Speed UART (ttyTHS*) via termios, no external lib
 * -------------------------------------------------------------------------*/

static const char * const _uart_devs[6] = {
    KRON_UART0, KRON_UART1, KRON_UART2, KRON_UART3, KRON_UART4, KRON_UART5
};

static inline speed_t _baud_to_speed(int32_t baud) {
    switch (baud) {
        case 9600:   return B9600;
        case 19200:  return B19200;
        case 38400:  return B38400;
        case 57600:  return B57600;
        case 115200: return B115200;
        case 230400: return B230400;
        case 460800: return B460800;
        case 921600: return B921600;
        default:     return B115200;
    }
}

static inline int _uart_open(uint8_t ch, int32_t baud) {
    if (ch >= 6) return -1;
    if (_uart_fd[ch] < 0) {
        int fd = open(_uart_devs[ch], O_RDWR | O_NOCTTY | O_NONBLOCK);
        if (fd < 0) return -1;

        struct termios tty;
        memset(&tty, 0, sizeof(tty));
        if (tcgetattr(fd, &tty) != 0) { close(fd); return -1; }

        speed_t spd = _baud_to_speed(baud);
        cfsetispeed(&tty, spd);
        cfsetospeed(&tty, spd);

        tty.c_cflag = (tty.c_cflag & ~CSIZE) | CS8;
        tty.c_cflag |= (CLOCAL | CREAD);
        tty.c_cflag &= ~(PARENB | PARODD | CSTOPB | CRTSCTS);
        tty.c_lflag  = 0;
        tty.c_oflag  = 0;
        tty.c_iflag  = 0;
        tty.c_cc[VMIN]  = 0;
        tty.c_cc[VTIME] = 1;

        if (tcsetattr(fd, TCSANOW, &tty) != 0) { close(fd); return -1; }
        _uart_fd[ch] = fd;
    }
    return _uart_fd[ch];
}

static inline void HAL_UART_Send_Call(HAL_UART_Send *inst, uint8_t ch) {
    inst->ENO  = inst->EN;
    inst->DONE = false;
    if (!inst->EN) return;

    int fd = _uart_open(ch, inst->BAUD);
    if (fd < 0) return;

    uint8_t byte = inst->DATA;
    inst->DONE = (write(fd, &byte, 1) == 1);
}

static inline void HAL_UART_Receive_Call(HAL_UART_Receive *inst, uint8_t ch) {
    inst->ENO   = inst->EN;
    inst->DATA  = 0;
    inst->READY = false;
    if (!inst->EN) return;

    int fd = _uart_open(ch, inst->BAUD);
    if (fd < 0) return;

    uint8_t byte = 0;
    ssize_t n = read(fd, &byte, 1);
    if (n == 1) {
        inst->DATA  = byte;
        inst->READY = true;
    }
}

/* ---------------------------------------------------------------------------
 * ADC  (Jetson has no built-in ADC on 40-pin header — stub)
 * -------------------------------------------------------------------------*/
static inline void HAL_ADC_Read_Call(HAL_ADC_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO     = inst->EN;
    inst->VALUE   = 0;
    inst->VOLTAGE = 0.0f;
}

/* ---------------------------------------------------------------------------
 * CAN  — SocketCAN (can0 / can1), no external library required
 * -------------------------------------------------------------------------*/

static const char * const _can_ifaces[2] = { KRON_CAN0, KRON_CAN1 };

static inline int _can_open(uint8_t ch) {
    if (ch >= 2) return -1;
    if (_can_fd[ch] >= 0) return _can_fd[ch];

    int fd = socket(AF_CAN, SOCK_RAW, CAN_RAW);
    if (fd < 0) return -1;

    struct ifreq ifr;
    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, _can_ifaces[ch], IFNAMSIZ - 1);
    if (ioctl(fd, SIOCGIFINDEX, &ifr) < 0) { close(fd); return -1; }

    struct sockaddr_can addr;
    memset(&addr, 0, sizeof(addr));
    addr.can_family  = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { close(fd); return -1; }

    /* Non-blocking reads */
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags >= 0) fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    _can_fd[ch] = fd;
    return fd;
}

static inline void HAL_CAN_Send_Call(HAL_CAN_Send *inst, uint8_t ch) {
    inst->ENO  = inst->EN;
    inst->DONE = false;
    if (!inst->EN) return;

    int fd = _can_open(ch);
    if (fd < 0) return;

    struct can_frame frame;
    memset(&frame, 0, sizeof(frame));
    frame.can_id  = (uint32_t)inst->ID & CAN_SFF_MASK;
    frame.can_dlc = (inst->DLC > 8) ? 8 : (uint8_t)inst->DLC;
    if (frame.can_dlc > 0) frame.data[0] = inst->DATA;

    inst->DONE = (write(fd, &frame, sizeof(frame)) == (ssize_t)sizeof(frame));
}

static inline void HAL_CAN_Receive_Call(HAL_CAN_Receive *inst, uint8_t ch) {
    inst->ENO   = inst->EN;
    inst->READY = false;
    inst->DATA  = 0;
    inst->ID    = 0;
    if (!inst->EN) return;

    int fd = _can_open(ch);
    if (fd < 0) return;

    struct can_frame frame;
    ssize_t n = read(fd, &frame, sizeof(frame));
    if (n == (ssize_t)sizeof(frame)) {
        if (inst->FILTER_ID == 0 || (int32_t)(frame.can_id & CAN_SFF_MASK) == inst->FILTER_ID) {
            inst->ID    = (int32_t)(frame.can_id & CAN_SFF_MASK);
            inst->DATA  = (frame.can_dlc > 0) ? frame.data[0] : 0;
            inst->READY = true;
        }
    }
}

/* ---------------------------------------------------------------------------
 * PRU  (not available on Jetson — stub)
 * -------------------------------------------------------------------------*/
static inline void HAL_PRU_Execute_Call(HAL_PRU_Execute *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->RESULT = 0; inst->DONE = false;
}

/* ---------------------------------------------------------------------------
 * PCM  (TODO: ALSA)
 * -------------------------------------------------------------------------*/
static inline void PCM_Output_Call(PCM_Output *inst) {
    inst->ENO = inst->EN; inst->OK = inst->EN;
}
static inline void PCM_Input_Call(PCM_Input *inst) {
    inst->ENO = inst->EN; inst->DATA = 0; inst->READY = false;
}

/* ---------------------------------------------------------------------------
 * Grove  (not available on Jetson — stub)
 * -------------------------------------------------------------------------*/
static inline void Grove_DigitalRead_Call(Grove_DigitalRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = false;
}
static inline void Grove_DigitalWrite_Call(Grove_DigitalWrite *inst) {
    inst->ENO = inst->EN; inst->OK = false;
}
static inline void Grove_AnalogRead_Call(Grove_AnalogRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = 0; inst->VOLTAGE = 0.0f;
}

/* ---------------------------------------------------------------------------
 * DI / DO  (not on standard Jetson — stub; use GPIO blocks instead)
 * -------------------------------------------------------------------------*/
static inline void HAL_DI_Read_Call(HAL_DI_Read *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->VALUE = false;
}
static inline void HAL_DO_Write_Call(HAL_DO_Write *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->OK = false;
}

#endif /* KRONHAL_JETSON_H */
