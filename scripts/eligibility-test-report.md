# Eligibility Test Report

Run: 2026-03-02T05:39:44.514Z

Total: 22 | Pass: 22 | Fail: 0

## All Results

- [PASS] **Scenario 1**: CS Sem-4 student CAN access dept+sem test (expected: true, got: true)
- [PASS] **Scenario 1**: CS Sem-3 student CANNOT access dept+sem test (wrong sem) (expected: false, got: false)
- [PASS] **Scenario 1**: ECE Sem-4 student CANNOT access dept+sem test (wrong dept) (expected: false, got: false)
- [PASS] **Scenario 1**: MECH Sem-6 student CANNOT access (wrong dept+sem) (expected: false, got: false)
- [PASS] **Scenario 2**: ECE Sem-1 CAN access dept-only test (expected: true, got: true)
- [PASS] **Scenario 2**: ECE Sem-8 CAN access dept-only test (expected: true, got: true)
- [PASS] **Scenario 2**: CS Sem-1 CANNOT access ECE-only test (expected: false, got: false)
- [PASS] **Scenario 3**: Civil Sem-6 CAN access sem-only test (expected: true, got: true)
- [PASS] **Scenario 3**: CS Sem-6 CAN access sem-only test (expected: true, got: true)
- [PASS] **Scenario 3**: Civil Sem-5 CANNOT access sem-6-only test (expected: false, got: false)
- [PASS] **Scenario 4**: CSV student (CS Sem-2) CAN access (expected: true, got: true)
- [PASS] **Scenario 4**: CSV student (Mech Sem-5) CAN access (expected: true, got: true)
- [PASS] **Scenario 4**: CSV student (Civil Sem-8) CAN access (expected: true, got: true)
- [PASS] **Scenario 4**: Non-CSV student (ECE Sem-3) CANNOT access (expected: false, got: false)
- [PASS] **Scenario 5**: CS Sem-4 CAN access (matches dept+sem) (expected: true, got: true)
- [PASS] **Scenario 5**: Mech Sem-7 CAN access (in CSV, overrides dept+sem) (expected: true, got: true)
- [PASS] **Scenario 5**: ECE Sem-4 CANNOT access (wrong dept, not in CSV) (expected: false, got: false)
- [PASS] **Scenario 5**: CS Sem-3 CANNOT access (wrong sem, not in CSV) (expected: false, got: false)
- [PASS] **Scenario 5**: Civil Sem-2 CANNOT access (wrong dept+sem, not in CSV) (expected: false, got: false)
- [PASS] **Scenario 6**: Any student CANNOT access test with no criteria (expected: false, got: false)
- [PASS] **Scenario 6**: Another student CANNOT access test with no criteria (expected: false, got: false)
- [PASS] **Scenario 7**: Any student CANNOT access test with empty arrays (expected: false, got: false)