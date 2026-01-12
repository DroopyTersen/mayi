# /af tag - GitHub Backend

Add or remove labels from an issue.

## Process

**Add label:**
```bash
gh issue edit NUMBER --add-label "tag-name"
```

**Remove label:**
```bash
gh issue edit NUMBER --remove-label "tag-name"
```

## Common Tags

- `needs-feedback` — Card waiting for human input
- `blocked` — External dependency blocking work

## Examples

```
/af tag 123 add needs-feedback
/af tag 123 remove blocked
```

## Confirm

"✅ Label `{tag}` added to #123"
"✅ Label `{tag}` removed from #123"
