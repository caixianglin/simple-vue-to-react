const parse = require('@babel/parser').parse;
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generate = require('@babel/generator').default;

const code = `
  const a = 1;
`;
const ast = parse(code);

traverse(ast, {
  VariableDeclaration: function (path) {
    if (path.node.kind === 'const') {
      path.replaceWith(
        t.variableDeclaration('var', path.node.declarations)
      );
    }
    path.skip();
  }
});

let result = generate(ast).code;
console.log(result); // var a = 1;