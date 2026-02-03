# Contributing to Engram

Thank you for your interest in contributing to Engram! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check the issue tracker to see if the bug has already been reported
2. Collect information about the bug:
   - Node.js version (`node --version`)
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages and stack traces

Create a bug report with:
- Clear, descriptive title
- Detailed description
- Steps to reproduce
- Code samples (if applicable)
- Screenshots (if relevant)

### Suggesting Features

Feature requests are welcome! Please:
1. Check if the feature has already been requested
2. Explain the use case clearly
3. Describe the desired behavior
4. Consider implementation complexity
5. Discuss alternatives you've considered

### Pull Requests

1. **Fork the repository** and create a branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Run tests** to ensure everything passes
6. **Commit with clear messages** following our commit conventions
7. **Submit a pull request** with a clear description

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/engram.git
cd engram

# Install dependencies
npm install

# Run tests
npm test

# Start development servers
npm start
```

## Project Structure

```
engram/
├── bin/                  # CLI entry point
├── src/
│   ├── config/          # Configuration management
│   ├── memory/          # Memory storage and retrieval
│   ├── embed/           # Embedding generation
│   ├── extract/         # Content extraction and validation
│   ├── server/          # MCP and REST servers
│   └── utils/           # Utilities
├── dashboard/           # Web dashboard (React)
├── test/               # Test suites
├── docs/               # Documentation
└── examples/           # Usage examples
```

## Coding Standards

### JavaScript/Node.js

- Use ESM modules (`import/export`)
- Follow existing code style
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Handle errors appropriately
- Use `async/await` for asynchronous code

### Example:

```javascript
/**
 * Recall memories using hybrid search
 * @param {Database} db - SQLite database instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>} Array of relevant memories
 */
export async function recallMemories(db, query, options = {}) {
  // Implementation
}
```

### React/Frontend

- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Ensure responsive design
- Handle loading and error states

### Testing

- Write tests for new functionality
- Maintain or improve test coverage
- Use descriptive test names
- Test both success and error cases

```javascript
describe('recallMemories', () => {
  it('should return relevant memories ranked by score', async () => {
    // Test implementation
  });

  it('should fall back to FTS when embeddings fail', async () => {
    // Test implementation
  });
});
```

## Commit Messages

Follow the conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(recall): add namespace filtering to search

fix(embed): handle model download failures gracefully

docs(api): update REST API endpoint documentation

test(store): add tests for memory CRUD operations
```

## Testing

### Running Tests

```bash
# Run all tests in watch mode
npm test

# Run tests once
npm run test:run

# Run specific test file
npx vitest test/memory/recall.test.js

# Run tests with coverage
npx vitest --coverage
```

### Writing Tests

- Place tests in the `test/` directory
- Mirror the source structure
- Use descriptive test names
- Test edge cases and error conditions
- Clean up resources in `afterEach`

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Memory Store', () => {
  let db;

  beforeEach(() => {
    // Setup
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    // Cleanup
    db.close();
  });

  it('should create a memory with all fields', () => {
    const memory = createMemory(db, {
      content: 'Test content',
      category: 'fact'
    });

    expect(memory).toBeDefined();
    expect(memory.content).toBe('Test content');
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Include parameter types and return types
- Provide usage examples for complex functions
- Document any non-obvious behavior

### User Documentation

- Update README.md for user-facing changes
- Add examples to the examples/ directory
- Update API documentation in docs/api.md
- Keep documentation clear and concise

## Pull Request Process

1. **Update Documentation**: Ensure README and docs reflect your changes
2. **Add Tests**: New features must include tests
3. **Run Tests**: Verify all tests pass (`npm test`)
4. **Run Linter**: Check code style (`npm run lint`)
5. **Update CHANGELOG**: Add entry for your changes (if applicable)
6. **Describe Changes**: Write a clear PR description
7. **Link Issues**: Reference related issues

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests passing
- [ ] Code follows style guidelines
```

## Areas for Contribution

### High Priority

- Performance optimizations
- Additional secret detection patterns
- Memory export/import functionality
- Backup and restore features
- Search query language enhancements

### Medium Priority

- Additional embedding models
- Custom consolidation rules
- Memory tagging improvements
- Dashboard UI enhancements
- More comprehensive examples

### Documentation

- Tutorial videos
- Architecture diagrams
- Performance benchmarks
- Deployment guides
- Translation to other languages

## Questions?

- Open a [discussion](https://github.com/your-username/engram/discussions)
- Ask in an existing issue
- Check the [documentation](docs/)

## License

By contributing to Engram, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Engram! 🙏
