# Spec: test coverage improvement

## Overview
Add new unit tests to improve the test coverage of the go backend codebase.
Focus on code that has below 80% test coverage. 
Add a new test file covering multiple functions or modules if necessary.
Test files must always express relation to the code they are testing in their filename.
Fix any errors you encounter along the way.
The test must pass successfully.

## Acceptance Criteria
1. Identify a function or module in the backend that currently has no test coverage.
2. Write a unit test for that function/module using the existing testing framework and conventions in the codebase.
3. The test must be deterministic and should not rely on external services or state.