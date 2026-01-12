# Project Configuration

IMPORTANT!!: Always read @docs/house-rules.md to understand the rules of the game and never do anything that contradicts the rules.

This project is a web application that enforces TDD development. When a bug is encountered we should first write a failing test.

## Verification

If we make changes to the game engine we should verify them via new tests and running old tests, as well as playing through the game with the [Agent Game Harness](../docs/agent-game-harness.md).

If we make changes to the UI and presentation layer we should try to first imeplment them in our diy StorybookLayout.tsx and verifying they look good by taking screenshots with the Claude Chrome extensions.
