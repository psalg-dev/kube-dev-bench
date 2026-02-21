import fs from 'fs';
import path from 'path';
import { Project, SyntaxKind, Node } from 'ts-morph';

const reportPath = path.resolve(process.cwd(), 'lint-report.json');
if (!fs.existsSync(reportPath)) {
  console.error('lint-report.json not found');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const project = new Project({
  tsConfigFilePath: path.resolve(process.cwd(), 'tsconfig.json'),
  skipFileDependencyResolution: true,
});

const RULE_UNUSED_BASE = 'no-unused-vars';
const RULE_UNUSED_TS = '@typescript-eslint/no-unused-vars';
const RULE_ANY = '@typescript-eslint/no-explicit-any';

const parseUnusedName = (message) => {
  const match = message.match(/'([^']+)' is defined but never used/);
  return match ? match[1] : null;
};

const touched = new Set();

function getSourceFile(absFilePath) {
  return project.getSourceFile(absFilePath) || project.addSourceFileAtPathIfExists(absFilePath);
}

function getNodeAt(sourceFile, line, column) {
  const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(Math.max(0, line - 1), Math.max(0, column - 1));
  return sourceFile.getDescendantAtPos(pos) || sourceFile.getDescendantAtStartWithWidth(pos, 1);
}

function ensureVoidUse(name, contextNode) {
  if (!name) return false;

  const statement = contextNode.getFirstAncestor((ancestor) => Node.isStatement(ancestor));
  if (!statement) return false;

  const parent = statement.getParent();
  if (!parent || (!Node.isBlock(parent) && !Node.isSourceFile(parent) && !Node.isCaseClause(parent) && !Node.isDefaultClause(parent))) {
    return false;
  }

  const stmtText = statement.getText();
  if (stmtText.includes(`void ${name}`) || stmtText.includes(`void(${name})`)) {
    return true;
  }

  if (Node.isSourceFile(parent)) {
    const index = parent.getStatements().findIndex((s) => s === statement);
    parent.insertStatements(index + 1, `void ${name};`);
    return true;
  }

  if (Node.isBlock(parent)) {
    const index = parent.getStatements().findIndex((s) => s === statement);
    parent.insertStatements(index + 1, `void ${name};`);
    return true;
  }

  if (Node.isCaseClause(parent) || Node.isDefaultClause(parent)) {
    const statements = parent.getStatements();
    const index = statements.findIndex((s) => s === statement);
    parent.insertStatements(index + 1, `void ${name};`);
    return true;
  }

  return false;
}

function handleAny(sourceFile, msg) {
  const node = getNodeAt(sourceFile, msg.line, msg.column);
  if (!node) return false;

  if (node.getKind() === SyntaxKind.AnyKeyword) {
    node.replaceWithText('unknown');
    return true;
  }

  const anyNode = node.getFirstAncestor((ancestor) => ancestor.getKind() === SyntaxKind.AnyKeyword);
  if (anyNode) {
    anyNode.replaceWithText('unknown');
    return true;
  }

  const text = node.getText();
  if (text === 'any') {
    node.replaceWithText('unknown');
    return true;
  }

  return false;
}

function removeImportNode(target) {
  if (Node.isImportSpecifier(target)) {
    const namedImports = target.getParentIfKind(SyntaxKind.NamedImports);
    target.remove();
    if (namedImports && namedImports.getElements().length === 0) {
      const importClause = namedImports.getParentIfKind(SyntaxKind.ImportClause);
      if (importClause && !importClause.getDefaultImport() && !importClause.getNamespaceImport()) {
        const importDecl = importClause.getParentIfKind(SyntaxKind.ImportDeclaration);
        if (importDecl) importDecl.remove();
      }
    }
    return true;
  }

  if (Node.isImportClause(target)) {
    const importDecl = target.getParentIfKind(SyntaxKind.ImportDeclaration);
    if (importDecl) {
      importDecl.remove();
      return true;
    }
  }

  if (Node.isNamespaceImport(target) || Node.isImportEqualsDeclaration(target)) {
    const importDecl = target.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    if (importDecl) {
      importDecl.remove();
      return true;
    }
    if (Node.isImportEqualsDeclaration(target)) {
      target.remove();
      return true;
    }
  }

  return false;
}

function handleUnused(sourceFile, msg) {
  const name = parseUnusedName(msg.message || '');
  if (!name) return false;

  const nodeAtPos = getNodeAt(sourceFile, msg.line, msg.column);
  if (!nodeAtPos) return false;

  const importNode = nodeAtPos.getFirstAncestor((a) => Node.isImportSpecifier(a) || Node.isImportClause(a) || Node.isNamespaceImport(a) || Node.isImportEqualsDeclaration(a));
  if (importNode && removeImportNode(importNode)) {
    return true;
  }

  const catchClause = nodeAtPos.getFirstAncestorByKind(SyntaxKind.CatchClause);
  if (catchClause && catchClause.getVariableDeclaration()?.getName() === name) {
    catchClause.removeVariableDeclaration();
    return true;
  }

  const parameter = nodeAtPos.getFirstAncestorByKind(SyntaxKind.Parameter);
  if (parameter && parameter.getName() === name) {
    const fnLike = parameter.getParent();
    if (Node.isArrowFunction(fnLike) || Node.isFunctionExpression(fnLike) || Node.isFunctionDeclaration(fnLike) || Node.isMethodDeclaration(fnLike)) {
      const params = fnLike.getParameters();
      const index = params.findIndex((p) => p === parameter);
      const canRemove = index === params.length - 1 || params.length === 1;
      if (canRemove && !parameter.isRestParameter()) {
        parameter.remove();
        return true;
      }

      const body = fnLike.getBody();
      if (Node.isBlock(body)) {
        const firstStmt = body.getStatements()[0];
        if (!firstStmt || !firstStmt.getText().includes(`void ${name};`)) {
          body.insertStatements(0, `void ${name};`);
        }
        return true;
      }

      if (Node.isArrowFunction(fnLike) && body) {
        const exprText = body.getText();
        fnLike.setBodyText(`{\nvoid ${name};\nreturn ${exprText};\n}`);
        return true;
      }
    }
  }

  const binding = nodeAtPos.getFirstAncestorByKind(SyntaxKind.BindingElement);
  if (binding && binding.getNameNode().getText() === name) {
    if (binding.isRestParameter && binding.isRestParameter()) {
      return ensureVoidUse(name, binding);
    }
    binding.remove();
    return true;
  }

  const varDecl = nodeAtPos.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (varDecl && varDecl.getName() === name) {
    const declList = varDecl.getParentIfKind(SyntaxKind.VariableDeclarationList);
    const varStmt = declList?.getParentIfKind(SyntaxKind.VariableStatement);

    if (declList && declList.getDeclarations().length === 1 && varStmt) {
      const init = varDecl.getInitializer();
      if (!init) {
        varStmt.remove();
        return true;
      }
    }

    return ensureVoidUse(name, varDecl);
  }

  const fnDecl = nodeAtPos.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (fnDecl && fnDecl.getName() === name) {
    const body = fnDecl.getBody();
    if (body) {
      const firstStmt = body.getStatements()[0];
      if (!firstStmt || !firstStmt.getText().includes(`void ${name};`)) {
        body.insertStatements(0, `void ${name};`);
      }
      return true;
    }
  }

  return ensureVoidUse(name, nodeAtPos);
}

for (const file of report) {
  const absPath = path.resolve(file.filePath);
  const sourceFile = getSourceFile(absPath);
  if (!sourceFile) continue;

  let changed = false;

  const messages = [...file.messages]
    .filter((m) => [RULE_UNUSED_BASE, RULE_UNUSED_TS, RULE_ANY].includes(m.ruleId))
    .sort((a, b) => (b.line - a.line) || (b.column - a.column));

  for (const msg of messages) {
    try {
      if (msg.ruleId === RULE_ANY) {
        changed = handleAny(sourceFile, msg) || changed;
      } else if (msg.ruleId === RULE_UNUSED_BASE || msg.ruleId === RULE_UNUSED_TS) {
        changed = handleUnused(sourceFile, msg) || changed;
      }
    } catch {
    }
  }

  if (changed) {
    touched.add(absPath);
    try {
      sourceFile.organizeImports();
    } catch {
    }
  }
}

project.saveSync();
console.log(`Touched ${touched.size} files`);
