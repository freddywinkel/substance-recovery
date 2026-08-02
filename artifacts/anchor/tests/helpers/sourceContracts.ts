import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const appRoot = fileURLToPath(new URL("../..", import.meta.url));

export function sourcePath(relativePath: string): string {
  return path.join(appRoot, relativePath);
}

export function readSource(relativePath: string): string {
  return fs.readFileSync(sourcePath(relativePath), "utf8");
}

export function parseSource(relativePath: string): ts.SourceFile {
  const fileName = sourcePath(relativePath);
  return ts.createSourceFile(
    fileName,
    fs.readFileSync(fileName, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function propertyName(node: ts.PropertyName): string {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

export function literalValue(node: ts.Expression): unknown {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return literalValue(node.expression);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    const value = Number(node.operand.text);
    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalValue(element as ts.Expression));
  }
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(`Unsupported object property: ${property.getText()}`);
        }
        return [propertyName(property.name), literalValue(property.initializer)];
      }),
    );
  }
  throw new Error(`Unsupported literal expression: ${node.getText()}`);
}

function findVariable(sourceFile: ts.SourceFile, variableName: string): ts.VariableDeclaration {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) {
        return declaration;
      }
    }
  }
  throw new Error(`Variable ${variableName} not found in ${sourceFile.fileName}`);
}

export function readLiteralVariable(relativePath: string, variableName: string): unknown {
  const declaration = findVariable(parseSource(relativePath), variableName);
  if (!declaration.initializer) throw new Error(`${variableName} has no initializer`);
  return literalValue(declaration.initializer);
}

export function objectPropertyNames(relativePath: string, variableName: string): string[] {
  const declaration = findVariable(parseSource(relativePath), variableName);
  if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error(`${variableName} is not an object literal`);
  }
  return declaration.initializer.properties.map((property) => {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`Unsupported object property: ${property.getText()}`);
    }
    return propertyName(property.name);
  });
}

export function typeAliasStringLiterals(relativePath: string, aliasName: string): string[] {
  const sourceFile = parseSource(relativePath);
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === aliasName,
  );
  if (!declaration) throw new Error(`Type alias ${aliasName} not found`);

  const members = ts.isUnionTypeNode(declaration.type) ? declaration.type.types : [declaration.type];
  return members.map((member) => {
    if (!ts.isLiteralTypeNode(member) || !ts.isStringLiteralLike(member.literal)) {
      throw new Error(`${aliasName} contains a non-string member: ${member.getText()}`);
    }
    return member.literal.text;
  });
}

export function stringsAssertedAsType(relativePath: string, typeName: string): string[] {
  const sourceFile = parseSource(relativePath);
  const values: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isAsExpression(node) &&
      ts.isTypeReferenceNode(node.type) &&
      ts.isIdentifier(node.type.typeName) &&
      node.type.typeName.text === typeName &&
      ts.isStringLiteralLike(node.expression)
    ) {
      values.push(node.expression.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

export function arrayObjectStringPropertyValuesContaining(
  relativePath: string,
  targetProperty: string,
  sentinelValue: string,
): string[] {
  const sourceFile = parseSource(relativePath);
  let match: string[] | undefined;

  function visit(node: ts.Node): void {
    if (match) return;
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.flatMap((element) => {
        if (!ts.isObjectLiteralExpression(element)) return [];
        const property = element.properties.find(
          (candidate): candidate is ts.PropertyAssignment =>
            ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === targetProperty,
        );
        if (!property) return [];
        const value = literalValue(property.initializer);
        return typeof value === "string" ? [value] : [];
      });
      if (values.includes(sentinelValue)) {
        match = values;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!match) {
    throw new Error(`No ${targetProperty} array containing ${sentinelValue} found in ${sourceFile.fileName}`);
  }
  return match;
}
