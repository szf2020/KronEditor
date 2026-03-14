/*
 * kronhal_pico.h  --  Raspberry Pi Pico (RP2040) HAL implementation
 *
 * Targets: rpi_pico, rpi_pico_w
 * Uses the Pico SDK API (hardware/gpio.h, hardware/pwm.h, etc.)
 *
 * NOTE: This is a skeleton -- real Pico SDK calls will be added
 * when cross-compilation for ARM Cortex-M0+ is implemented.
 */
#ifndef KRONHAL_PICO_H
#define KRONHAL_PICO_H

/* Lifecycle */
static inline void HAL_Init(void)    { /* TODO: stdio_init_all() */ }
static inline void HAL_Cleanup(void) {}

/* GPIO */
static inline void GPIO_Read_Call(GPIO_Read *inst) {
    inst->ENO = inst->EN;
    /* TODO: gpio_get(inst->PIN) */
    inst->VALUE = false;
}
static inline void GPIO_Write_Call(GPIO_Write *inst) {
    inst->ENO = inst->EN;
    /* TODO: gpio_put(inst->PIN, inst->VALUE) */
    inst->OK = inst->EN;
}
static inline void GPIO_SetMode_Call(GPIO_SetMode *inst) {
    inst->ENO = inst->EN;
    /* TODO: gpio_init + gpio_set_dir */
    inst->OK = inst->EN;
}

/* PWM */
static inline void HAL_PWM_Call(HAL_PWM *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: pwm_set_wrap / pwm_set_chan_level */
    inst->ACTIVE = inst->EN;
}

/* SPI */
static inline void HAL_SPI_Call(HAL_SPI *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: spi_write_read_blocking */
    inst->RX_DATA = 0;
    inst->DONE = inst->EN;
}

/* I2C */
static inline void HAL_I2C_Read_Call(HAL_I2C_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: i2c_read_blocking */
    inst->DATA = 0;
    inst->OK = inst->EN;
}
static inline void HAL_I2C_Write_Call(HAL_I2C_Write *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: i2c_write_blocking */
    inst->OK = inst->EN;
}

/* UART */
static inline void HAL_UART_Send_Call(HAL_UART_Send *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: uart_putc_raw */
    inst->DONE = inst->EN;
}
static inline void HAL_UART_Receive_Call(HAL_UART_Receive *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->DATA = 0;
    inst->READY = false;
}

/* ADC */
static inline void HAL_ADC_Read_Call(HAL_ADC_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    /* TODO: adc_select_input(ch); adc_read() */
    inst->VALUE = 0;
    inst->VOLTAGE = 0.0f;
}

/* CAN -- not available on Pico */
static inline void HAL_CAN_Send_Call(HAL_CAN_Send *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->DONE = false;
}
static inline void HAL_CAN_Receive_Call(HAL_CAN_Receive *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->READY = false;
}

/* PRU -- not available on Pico */
static inline void HAL_PRU_Execute_Call(HAL_PRU_Execute *inst, uint8_t ch) {
    (void)ch; inst->ENO = inst->EN; inst->RESULT = 0; inst->DONE = false;
}

/* PCM -- not available on Pico */
static inline void PCM_Output_Call(PCM_Output *inst) {
    inst->ENO = inst->EN; inst->OK = false;
}
static inline void PCM_Input_Call(PCM_Input *inst) {
    inst->ENO = inst->EN; inst->DATA = 0; inst->READY = false;
}

/* Grove -- not natively available on Pico */
static inline void Grove_DigitalRead_Call(Grove_DigitalRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = false;
}
static inline void Grove_DigitalWrite_Call(Grove_DigitalWrite *inst) {
    inst->ENO = inst->EN; inst->OK = false;
}
static inline void Grove_AnalogRead_Call(Grove_AnalogRead *inst) {
    inst->ENO = inst->EN; inst->VALUE = 0; inst->VOLTAGE = 0.0f;
}

#endif /* KRONHAL_PICO_H */
