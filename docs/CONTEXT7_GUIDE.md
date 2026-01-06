# Context7 MCP Integration Guide

This guide explains how to leverage Context7 MCP for intelligent code assistance in this project.

## What is Context7?

Context7 is a Model Context Protocol server that provides AI assistants with up-to-date documentation and code examples for any library or framework. It eliminates the need to browse through documentation manually.

## Setup

Context7 is already configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "your-api-key"
      }
    }
  }
}
```

## How to Use Context7

When working with Claude Code or similar AI assistants, Context7 is automatically invoked when you ask questions about libraries. Here are common usage patterns:

### 1. Get Documentation Examples

```
"How do I use Keystone's text field?"
"Show me examples of Mongoose schema indexes"
"What are the methods available on Kubernetes Informer?"
```

### 2. Troubleshooting Issues

```
"Why is my Prisma migration failing?"
"How do I handle MongoDB connection errors in Mongoose?"
"What causes 'ECONNREFUSED' in Kubernetes client?"
```

### 3. Best Practices

```
"What's the best way to structure Keystone lists?"
"How should I organize Mongoose models?"
"Best practices for error handling in Express routes?"
```

### 4. API Reference

```
"What parameters does mongoose.model() accept?"
"What's the signature of kc.makeApiClient()?"
"How do I use Prisma's include parameter?"
```

## Key Libraries in This Project

Context7 has extensive documentation for:

### Keystone 6

- **Package**: `@keystone-6/core`
- **Common Tasks**:
  - Defining lists and fields
  - Access control
  - Session management
  - GraphQL API queries

### Kubernetes Client

- **Package**: `@kubernetes/client-node`
- **Common Tasks**:
  - Creating Informers
  - Watch handlers
  - API client configuration
  - Resource CRUD operations

### Mongoose

- **Package**: `mongoose`
- **Common Tasks**:
  - Schema definition
  - Model creation
  - Query building
  - Middleware

### Express

- **Package**: `express`
- **Common Tasks**:
  - Route handlers
  - Middleware
  - Error handling
  - Request parsing

### Prisma

- **Package**: `prisma` & `@prisma/client`
- **Common Tasks**:
  - Schema definition
  - Migrations
  - Client generation
  - Type-safe queries

## Example Workflows

### Adding a New Keystone Field

**Prompt**: "How do I add a relationship field in Keystone 6?"

Context7 will provide:

- Field configuration examples
- Relationship types (one-to-one, one-to-many, many-to-many)
- Ref field usage
- Best practices for database design

### Implementing Kubernetes Informer

**Prompt**: "Show me examples of Kubernetes Informer watch handlers"

Context7 will provide:

- Informer setup code
- Event types (ADDED, MODIFIED, DELETED)
- Handler function signatures
- Error handling patterns

### Debugging Mongoose Issues

**Prompt**: "Why is my Mongoose query returning empty results?"

Context7 will provide:

- Common causes (wrong collection name, query syntax)
- Debugging techniques
- Connection issues
- Query examples

## Tips for Best Results

1. **Be Specific**: Include the library name and what you're trying to do
   - ✅ "How do I add a virtual field in Mongoose?"
   - ❌ "How do I add a field?"

2. **Include Context**: Mention your current setup if relevant
   - ✅ "I'm using Keystone 6 with MongoDB, how do I implement pagination?"
   - ❌ "How do I implement pagination?"

3. **Ask for Examples**: Request code samples when applicable
   - ✅ "Show me examples of Express middleware for error handling"
   - ❌ "Tell me about error handling"

4. **Reference Errors**: Include error messages for troubleshooting
   - ✅ "What does 'CastError: Cast to ObjectId failed' mean in Mongoose?"
   - ❌ "I have an error"

## Integration with Development Workflow

Context7 works seamlessly with:

- **Code Generation**: Ask for examples and adapt them to your needs
- **Refactoring**: Get best practices before making changes
- **Debugging**: Understand error messages and find solutions
- **Learning**: Explore new features and patterns

## Troubleshooting Context7

If Context7 isn't responding:

1. Check your internet connection
2. Verify the API key in `.mcp.json`
3. Ensure the MCP server is running
4. Check for rate limits (if applicable)

## Additional Resources

- Context7 Documentation: https://context7.com
- MCP Protocol: https://modelcontextprotocol.io
- Project-specific docs: See [CLAUDE.md](../CLAUDE.md)

## Examples for This Project

Here are some ready-to-use prompts for common tasks in this codebase:

### Adding New K8s Resources

```
"How do I create a Mongoose model for a Kubernetes resource?"
"Show me examples of TypeScript interfaces for Mongoose documents"
```

### API Development

```
"How do I add error handling middleware in Express?"
"What's the best way to structure REST API routes in Express?"
```

### Database Operations

```
"How do I use Mongoose's findOneAndUpdate with upsert?"
"Show me examples of MongoDB aggregation pipelines"
```

### Keystone Customization

```
"How do I add custom mutations to Keystone's GraphQL API?"
"What are the best practices for Keystone access control?"
```
