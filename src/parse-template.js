const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const parseTemplate = (ast, json) => {
  let argument = null;

  function identifier(value) {
    let flag = json.props[value] ? t.identifier('props') : (json.data[value] ? t.identifier('state') : null);

    if (!flag) return null;
    return t.memberExpression(
      t.memberExpression(t.thisExpression(), flag),
      t.identifier(value)
    );
  }

  traverse(ast, {
    ExpressionStatement: {
      enter(path) {},
      exit(path) {
        argument = path.node.expression;
      }
    },
    JSXAttribute(path) {
      const node = path.node;

      if (node.name.name === 'class') {
        path.replaceWith(
          t.jsxAttribute(t.jsxIdentifier('className'), node.value)
        );
        return;
      } else if (node.name.name === 'v-if') {
        let parentPath = path.parentPath.parentPath;
        let expression = identifier(node.value.value);

        if (!expression) {
          path.remove();
          return;
        }
        parentPath.replaceWith(
          t.jSXExpressionContainer( // 条件 ? success : false
            t.conditionalExpression(
              expression,
              parentPath.node,
              t.nullLiteral()
            )
          )
        );
        path.remove();
      } else if (t.isJSXNamespacedName(node.name)) {
        if (node.name.namespace.name === 'v-on') {
          path.replaceWith(
            t.jsxAttribute(t.jsxIdentifier('onClick'), t.jsxExpressionContainer(
              t.memberExpression(
                t.thisExpression(),
                t.identifier(node.value.value)
              )
            ))
          );
        }
      }
    },
    JSXExpressionContainer(path) {
      const name = path.node.expression.name;
      if (name && path.container) {
        let expression = identifier(name);

        if (!expression) return;
        path.replaceWith(
          t.jSXExpressionContainer(expression)
        );
      }
    }
  });

  return argument;
};

const genTemplate = (path, args) => {
  // template->render
  const render = t.classMethod(
    "method",
    t.identifier("render"),
    [],
    t.blockStatement(
      [].concat(t.returnStatement(args))
    )
  );
  path.node.body.push(render);
};

module.exports = {
  parseTemplate,
  genTemplate
};