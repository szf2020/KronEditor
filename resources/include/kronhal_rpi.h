/*
 * kronhal_rpi.h  --  Raspberry Pi family HAL implementation
 *
 * Targets: rpi_3b, rpi_3b_plus, rpi_4b, rpi_5, rpi_zero_2w
 * Uses Linux sysfs / libgpiod for GPIO access.
 *
 * NOTE: This is a skeleton -- real hardware calls will be added
 * when cross-compilation for ARM targets is implemented.
 */
#ifndef KRONHAL_RPI_H
#define KRONHAL_RPI_H

/* Lifecycle */
static inline void HAL_Init(void)    { /* TODO: open /dev/gpiochip0 */ }
static inline void HAL_Cleanup(void) { /* TODO: close handles */ }

/* GPIO */
static inline void GPIO_Read_Call(GPIO_Read *inst) {
    inst->ENO = inst->EN;
    /* TODO: sysfs/gpiod read from inst->PIN */
    inst->VALUE = false;
}
static inline void GPIO_Write_Call(GPIO_Write *inst) {
    inst->ENO = inst->EN;
    /* TODO: sysfs/gpiod write inst->VALUE to inst->PIN */
    inst->OK = inst->EN;
}
static inline void GPIO_SetMode_Call(GPIO_SetMode *inst) {
    inst->ENO = inst->EN;
    /* TODO: configure pin direction */
    inst->OK = inst->EN;
}

/* PWM */
static inline void HAL_PWM_Call(HAL_PWM *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: /sys/class/pwm/ or pigpio */
    inst->ACTIVE = inst->EN;
}

/* SPI */
static inline void HAL_SPI_Call(HAL_SPI *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: /dev/spidevN.0 ioctl */
    inst->RX_DATA = 0;
    inst->DONE = inst->EN;
}

/* I2C */
static inline void HAL_I2C_Read_Call(HAL_I2C_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: /dev/i2c-N ioctl */
    inst->DATA = 0;
    inst->OK = inst->EN;
}
static inline void HAL_I2C_Write_Call(HAL_I2C_Write *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}

/* UART */
static inline void HAL_UART_Send_Call(HAL_UART_Send *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: /dev/ttyAMA0 write */
    inst->DONE = inst->EN;
}
static inline void HAL_UART_Receive_Call(HAL_UART_Receive *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->DATA = 0;
    inst->READY = false;
}

/* ADC -- RPi has no built-in ADC, stub only */
static inline void HAL_ADC_Read_Call(HAL_ADC_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->VALUE = 0;
    inst->VOLTAGE = 0.0f;
}

/* CAN -- not available on standard RPi */
static inline void HAL_CAN_Send_Call(HAL_CAN_Send *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->DONE = false;
}
static inline void HAL_CAN_Receive_Call(HAL_CAN_Receive *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->READY = false;
}

/* PRU -- not available on RPi */
static inline void HAL_PRU_Execute_Call(HAL_PRU_Execute *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->RESULT = 0; inst->DONE = false;
}

/* PCM */
static inline void PCM_Output_Call(PCM_Output *inst) {
    inst->ENO = inst->EN;
    /* TODO: ALSA PCM output */
    inst->OK = inst->EN;
}
static inline void PCM_Input_Call(PCM_Input *inst) {
    inst->ENO = inst->EN;
    inst->DATA = 0;
    inst->READY = false;
}

/* Grove -- not natively available on RPi */
static inline void Grove_DigitalRead_Call(Grove_DigitalRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = false;
}
static inline void Grove_DigitalWrite_Call(Grove_DigitalWrite *inst) {
    inst->ENO = inst->EN; inst->OK = false;
}
static inline void Grove_AnalogRead_Call(Grove_AnalogRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = 0; inst->VOLTAGE = 0.0f;
}

#endif /* KRONHAL_RPI_H */
