/*
 * kronhal_sim.h  --  Simulation stubs for KronEditor HAL
 *
 * All functions return safe defaults so the PLC code compiles and
 * runs on the host machine during simulation.  No real hardware
 * is accessed.
 */
#ifndef KRONHAL_SIM_H
#define KRONHAL_SIM_H

/* Lifecycle */
static inline void HAL_Init(void)    {}
static inline void HAL_Cleanup(void) {}

/* GPIO */
static inline void GPIO_Read_Call(GPIO_Read *inst) {
    inst->ENO = inst->EN;
    inst->VALUE = false;
}
static inline void GPIO_Write_Call(GPIO_Write *inst) {
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}
static inline void GPIO_SetMode_Call(GPIO_SetMode *inst) {
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}

/* PWM */
static inline void HAL_PWM_Call(HAL_PWM *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->ACTIVE = inst->EN;
}

/* SPI */
static inline void HAL_SPI_Call(HAL_SPI *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->RX_DATA = 0;
    inst->DONE = inst->EN;
}

/* I2C Read */
static inline void HAL_I2C_Read_Call(HAL_I2C_Read *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->DATA = 0;
    inst->OK = inst->EN;
}

/* I2C Write */
static inline void HAL_I2C_Write_Call(HAL_I2C_Write *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}

/* UART Send */
static inline void HAL_UART_Send_Call(HAL_UART_Send *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->DONE = inst->EN;
}

/* UART Receive */
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
    inst->VALUE = 0;
    inst->VOLTAGE = 0.0f;
}

/* CAN Send */
static inline void HAL_CAN_Send_Call(HAL_CAN_Send *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->DONE = inst->EN;
}

/* CAN Receive */
static inline void HAL_CAN_Receive_Call(HAL_CAN_Receive *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->ID = 0;
    inst->DATA = 0;
    inst->READY = false;
}

/* PRU */
static inline void HAL_PRU_Execute_Call(HAL_PRU_Execute *inst, uint8_t ch) {
    (void)ch;
    inst->ENO = inst->EN;
    inst->RESULT = 0;
    inst->DONE = inst->EN;
}

/* PCM */
static inline void PCM_Output_Call(PCM_Output *inst) {
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}
static inline void PCM_Input_Call(PCM_Input *inst) {
    inst->ENO = inst->EN;
    inst->DATA = 0;
    inst->READY = false;
}

/* Grove */
static inline void Grove_DigitalRead_Call(Grove_DigitalRead *inst) {
    inst->ENO = inst->EN;
    inst->VALUE = false;
}
static inline void Grove_DigitalWrite_Call(Grove_DigitalWrite *inst) {
    inst->ENO = inst->EN;
    inst->OK = inst->EN;
}
static inline void Grove_AnalogRead_Call(Grove_AnalogRead *inst) {
    inst->ENO = inst->EN;
    inst->VALUE = 0;
    inst->VOLTAGE = 0.0f;
}

#endif /* KRONHAL_SIM_H */
