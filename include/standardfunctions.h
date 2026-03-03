#ifndef STANDARDFUNCTION_H
#define STANDARDFUNCTION_H

#include <stdbool.h>
#include <stdint.h>

// TIME is treated as milliseconds
typedef uint32_t TIME;

// Timer On Delay (TON)
typedef struct {
    TIME PT;        // Preset Time (32-bit)
    TIME ET;        // Elapsed Time (32-bit)
    TIME StartTime; // Internal start time (32-bit)
    bool IN;        // Input (1-bit / 8-bit)
    bool Q;         // Output (1-bit / 8-bit)
    bool M;         // Internal marker (1-bit / 8-bit)
} TON;

// Timer Off Delay (TOF)
typedef struct {
    TIME PT;        // Preset Time (32-bit)
    TIME ET;        // Elapsed Time (32-bit)
    TIME StartTime; // Internal start time (32-bit)
    bool IN;        // Input (1-bit / 8-bit)
    bool Q;         // Output (1-bit / 8-bit)
    bool M;         // Internal marker (1-bit / 8-bit)
} TOF;

// Count Up (CTU)
typedef struct {
    int16_t PV;     // Preset Value (16-bit)
    int16_t CV;     // Current Value (16-bit)
    bool CU;        // Count Up input (1-bit / 8-bit)
    bool RESET;     // Reset input (1-bit / 8-bit)
    bool Q;         // Output (CV >= PV) (1-bit / 8-bit)
    bool M;         // Edge marker (1-bit / 8-bit)
} CTU;

// Timer Pulse (TP)
typedef struct {
    TIME PT;        // Preset Time (32-bit)
    TIME ET;        // Elapsed Time (32-bit)
    TIME StartTime; // Internal start time (32-bit)
    bool IN;        // Input (1-bit / 8-bit)
    bool Q;         // Output (1-bit / 8-bit)
    bool M;         // Internal marker: timer is running (1-bit / 8-bit)
} TP;

// Count Down (CTD)
typedef struct {
    int16_t PV;     // Preset Value (16-bit)
    int16_t CV;     // Current Value (16-bit)
    bool CD;        // Count Down input (1-bit / 8-bit)
    bool LD;        // Load input: loads PV into CV (1-bit / 8-bit)
    bool Q;         // Output (CV <= 0) (1-bit / 8-bit)
    bool M;         // Edge marker (1-bit / 8-bit)
} CTD;

// Count Up/Down (CTUD)
typedef struct {
    int16_t PV;     // Preset Value (16-bit)
    int16_t CV;     // Current Value (16-bit)
    bool CU;        // Count Up input (1-bit / 8-bit)
    bool CD;        // Count Down input (1-bit / 8-bit)
    bool RESET;     // Reset input (1-bit / 8-bit)
    bool LD;        // Load input: loads PV into CV (1-bit / 8-bit)
    bool QU;        // Output Up (CV >= PV) (1-bit / 8-bit)
    bool QD;        // Output Down (CV <= 0) (1-bit / 8-bit)
    bool MU;        // Edge marker for CU (1-bit / 8-bit)
    bool MD;        // Edge marker for CD (1-bit / 8-bit)
} CTUD;

// SR Bistable (Set dominant)
typedef struct {
    bool S1;        // Set input - dominant (1-bit / 8-bit)
    bool R;         // Reset input (1-bit / 8-bit)
    bool Q1;        // Output (1-bit / 8-bit)
} SR;

// RS Bistable (Reset dominant)
typedef struct {
    bool S;         // Set input (1-bit / 8-bit)
    bool R1;        // Reset input - dominant (1-bit / 8-bit)
    bool Q1;        // Output (1-bit / 8-bit)
} RS;

// Rising Edge Trigger (R_TRIG)
typedef struct {
    bool CLK;       // Clock input (1-bit / 8-bit)
    bool Q;         // Output: true for one scan on rising edge (1-bit / 8-bit)
    bool M;         // Internal marker: previous CLK state (1-bit / 8-bit)
} R_TRIG;

// Falling Edge Trigger (F_TRIG)
typedef struct {
    bool CLK;       // Clock input (1-bit / 8-bit)
    bool Q;         // Output: true for one scan on falling edge (1-bit / 8-bit)
    bool M;         // Internal marker: previous CLK state (1-bit / 8-bit)
} F_TRIG;

// Function Prototypes
void TON_Call(TON *inst, TIME currentTime);
void TOF_Call(TOF *inst, TIME currentTime);
void CTU_Call(CTU *inst);
void TP_Call(TP *inst, TIME currentTime);
void CTD_Call(CTD *inst);
void CTUD_Call(CTUD *inst);
void SR_Call(SR *inst);
void RS_Call(RS *inst);
void R_TRIG_Call(R_TRIG *inst);
void F_TRIG_Call(F_TRIG *inst);

#endif // STANDARDFUNCTION_H
