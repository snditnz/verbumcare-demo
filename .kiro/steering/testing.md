---
inclusion: always
---

# Testing Guidelines

## Jest Test Execution

**CRITICAL: Jest does NOT support a `--run` flag**

### Correct Jest Commands

For iPad App (React Native/Jest):
```bash
# Run specific test file
npm test -- performance.property.test.ts

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testNamePattern="Property 55"
```

### Common Mistakes to AVOID

❌ **WRONG**: `npm test -- performance.property.test.ts --run`
✅ **CORRECT**: `npm test -- performance.property.test.ts`

❌ **WRONG**: `jest --run`
✅ **CORRECT**: `jest` (runs once by default)

### Vitest vs Jest

- **Vitest**: Uses `--run` flag to run once (non-watch mode)
- **Jest**: Runs once by default, NO `--run` flag exists
- **Backend tests**: Use Jest (Node.js)
- **iPad app tests**: Use Jest (React Native)

### Test Timeouts

If tests appear hung:
1. Check for async operations without proper awaits
2. Check for infinite loops in property generators
3. Add timeout to specific tests: `it('test', async () => {...}, 30000)` (30 seconds)
4. Check console output for actual errors

### Property-Based Testing with fast-check

- Default timeout: 5000ms per test
- Increase for slow property tests: `jest.setTimeout(30000)` in test file
- Use `numRuns: 100` for thorough testing
- Use `numRuns: 10` for quick smoke tests during development

## Test File Patterns

- Unit tests: `*.test.ts` or `*.test.tsx`
- Property tests: `*.property.test.ts`
- Integration tests: `*.integration.test.ts`

## Running Tests by Type

```bash
# Run only property tests
npm test -- --testPathPattern="property.test"

# Run only unit tests (exclude property tests)
npm test -- --testPathPattern="test.ts$" --testPathIgnorePatterns="property"

# Run specific test suite
npm test -- --testNamePattern="Property 55"
```

## Debugging Hung Tests

If a test appears to hang:

1. **Add verbose output**:
   ```bash
   npm test -- performance.property.test.ts --verbose
   ```

2. **Run with detectOpenHandles**:
   ```bash
   npm test -- performance.property.test.ts --detectOpenHandles
   ```

3. **Check for missing done() or async/await**:
   - All async tests must use `async/await`
   - Property tests with `fc.asyncProperty` must be awaited

4. **Add console.log statements** to track progress

5. **Reduce numRuns** temporarily:
   ```typescript
   { numRuns: 10 } // Instead of 100 for debugging
   ```

## Memory and Performance

- Property tests with large datasets may take time
- Use `--maxWorkers=1` for memory-intensive tests
- Monitor test execution time with `--verbose`

## Backend Tests (Node.js/Jest)

Backend tests may require:
- Remote Docker services running (PostgreSQL on verbumcare-lab.local)
- Database connection available
- See deployment-context.md for remote server setup

If backend tests fail with connection errors:
1. Verify Docker services are running on remote server
2. Check network connectivity to verbumcare-lab.local
3. Verify database credentials in .env file
