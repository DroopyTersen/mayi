# Project Configuration

IMPORTANT!!: Always read @docs/house-rules.md to understand the rules of the game and never do anything that contradicts the rules.

This project is a web application that enforces TDD development. When a bug is encountered we should first write a failing test.

## Verification

If we make changes to the game engine we should verify them via new tests and running old tests, as well as playing through the game with the [Agent Game Harness](../docs/agent-game-harness.md). It's the MayI Harness skill.

If we make changes to the UI and presentation layer we should try to first imeplment them in our diy StorybookLayout.tsx and verifying they look good by taking screenshots with the Claude Chrome extensions.

VERIFICATION IS CRITICAL!!
always run tests, typecheck, and build before and after each change. YOu should typically also try to play through the game with the web app or agent harness.

## How to begin

Review the progress.txt
Pull down the list of backlog items with /af list
Choose a work item.
Make sure to pull down the entire work item with /af show <id> - it is critical to pull down both the body and comments on the Github issue.
Make yourself a little todo list on how to get this work item to the next phase (or what you'll need in order to pose good questions for human feedback).

## Human Feedback

Tag the github issue and pose your questions to the human as a comment on the issue. Eventually the human will answer via a Github Issue comment and remove the tag so you can proceed.
