#ifndef KRON_MOCK_IO_H
#define KRON_MOCK_IO_H

#include <stdint.h>
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

static inline void digitalWrite(int pin, int value) {
    fprintf(stderr, "[kron_mock_io] digitalWrite(pin=%d, value=%d)\n", pin, value);
}

static inline int digitalRead(int pin) {
    fprintf(stderr, "[kron_mock_io] digitalRead(pin=%d) -> 0\n", pin);
    return 0;
}

static inline void analogWrite(int pin, int value) {
    fprintf(stderr, "[kron_mock_io] analogWrite(pin=%d, value=%d)\n", pin, value);
}

static inline int analogRead(int pin) {
    fprintf(stderr, "[kron_mock_io] analogRead(pin=%d) -> 0\n", pin);
    return 0;
}

static inline void pwmWrite(int pin, float duty_cycle) {
    fprintf(stderr, "[kron_mock_io] pwmWrite(pin=%d, duty_cycle=%0.3f)\n", pin, (double)duty_cycle);
}

static inline void pinMode(int pin, int mode) {
    fprintf(stderr, "[kron_mock_io] pinMode(pin=%d, mode=%d)\n", pin, mode);
}

static inline void delay(unsigned int ms) {
    fprintf(stderr, "[kron_mock_io] delay(ms=%u)\n", ms);
}

static inline void delayMicroseconds(unsigned int us) {
    fprintf(stderr, "[kron_mock_io] delayMicroseconds(us=%u)\n", us);
}

#ifdef __cplusplus
}
#endif

#endif
