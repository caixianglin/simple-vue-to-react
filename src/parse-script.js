const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

// 解析data
const analysisData = (body, data, isObject) => {
  let propNodes = [];
  if (isObject) {
    propNodes = body;
    data._statements = [].concat(body);
  } else {
    body.forEach(child => {
      if (t.isReturnStatement(child)) {
        propNodes = child.argument.properties;
        data._statements = [].concat(child.argument.properties);
      }
    });
  }

  propNodes.forEach(propNode => {
    data[propNode.key.name] = propNode;
  });
};

// 解析props
const analysisProps = {
  ObjectProperty(path) {
    const parent = path.parentPath.parent;

    if (parent.key && parent.key.name === this.childName) {
      const key = path.node.key;
      const node = path.node.value;

      if (key.name === 'type') {
        if (t.isIdentifier(node)) {
          this.result.props[this.childName].type = node.name.toLowerCase();
        } else if (t.isArrayExpression(node)) {
          let elements = [];
          node.elements.forEach(child => {
            elements.push(child.name.toLowerCase());
          });
          this.result.props[this.childName].type = elements.length > 1 ? 'array' : elements[0] ? elements[0] : elements;
          this.result.props[this.childName].value = elements.length === 1 ? elements[0] : elements;
        }
      }

      if (t.isLiteral(node)) {
        if (key.name === 'default') {
          this.result.props[this.childName].defaultValue = node.value;
        }

        if (key.name === 'required') {
          this.result.props[this.childName].required = node.value;
        }
      }
    }
  }
};

// life-cycle
const cycle = {
  'created': 'componentWillMount',
  'mounted': 'componentDidMount',
  'beforeUpdated': 'componentWillUpdate',
  'updated': 'componentDidUpdate',
  'beforeDestroy': 'componentWillUnmount'
}

const parseScript = (ast) => {
  let result = {
    data: {},
    props: {},
    methods: [],
    cycle: []
  };

  traverse(ast, {
    /**
     * 对象方法
     * data() {return {}}
     */
    ObjectMethod(path) {
      const parent = path.parentPath.parent;
      const name = path.node.key.name;

      if (parent && t.isExportDefaultDeclaration(parent)) {
        if (name === 'data') {
          const body = path.node.body.body;
          analysisData(body, result.data);
        } else if (name && Object.keys(cycle).indexOf(name) >= 0) {
          let expressions = path.node.body.body;
          let newExpressions = [];
          if (expressions.length > 0) {
            expressions.forEach(node => {
              let args = node.expression.arguments;
              let newArgs = [];
              if (args.length > 0) {
                args.forEach(arg => {
                  if (t.isMemberExpression(arg)) {
                    // data.name
                    if (result.data[arg.property.name]) {
                      newArgs.push(t.memberExpression(
                        t.memberExpression(
                          t.thisExpression(),
                          t.identifier('state')
                        ),
                        t.identifier(arg.property.name)
                      ))
                    }
                  } else {
                    newArgs.push(arg);
                  }
                });
              }
              newExpressions.push(t.expressionStatement(
                t.callExpression(t.memberExpression(
                  t.identifier('console'),
                  t.identifier('log')
                ), newArgs)
              ));
            });
          }
          path.replaceWith(t.objectMethod(
            'method',
            t.identifier(name),
            [],
            t.blockStatement(newExpressions)
          ));

          result.cycle.push(path.node);
          // 防止超过最大堆栈内存
          path.remove();
        }
      }
    },
    /**
     * 对象属性、箭头函数
     * data: () => {return {}}
     * data: () => ({})
     * props: []
     * props: {
     *    name: String
     * }
     * props: {
     *    name: {
     *      type: String
     *    }
     * }
     */
    ObjectProperty(path) {
      const parent = path.parentPath.parent;

      if (parent && t.isExportDefaultDeclaration(parent)) {
        const name = path.node.key.name;
        const node = path.node.value;
        if (name === 'data') {
          if (t.isArrowFunctionExpression(node)) {
            if (node.body.body) {
              // return {}
              analysisData(node.body.body, result.data);
            } else {
              // {}
              analysisData(node.body.properties, result.data, true);
            }
          }
        } else if (name === 'props') {
          if (t.isArrayExpression(node)) {
            node.elements.forEach(child => {
              result.props[child.value] = {
                type: undefined,
                value: undefined,
                required: false,
                validator: false
              }
            });
          } else if (t.isObjectExpression(node)) {
            const childs = node.properties;
            if (childs.length > 0) {
              path.traverse({
                ObjectProperty(propPath) {
                  const propParent = propPath.parentPath.parent;
                  if (propParent.key && propParent.key.name === name) {
                    const childName = propPath.node.key.name;
                    const childVal = propPath.node.value;
                    // console.log(childVal.type);
                    if (t.isIdentifier(childVal)) {
                      result.props[childName] = {
                        type: childVal.name.toLowerCase(),
                        value: undefined,
                        required: false,
                        validator: false
                      }
                    } else if (t.isArrayExpression(childVal)) {
                      let elements = [];
                      childVal.elements.forEach(child => {
                        elements.push(child.name.toLowerCase());
                      });
                      result.props[childName] = {
                        type: elements.length > 1 ? 'array' : elements[0] ? elements[0] : elements,
                        value: elements.length === 1 ? elements[0] : elements,
                        required: false,
                        validator: false
                      }
                    } else if (t.isObjectExpression(childVal)) {
                      result.props[childName] = {
                        type: '',
                        value: undefined,
                        required: false,
                        validator: false
                      }
                      path.traverse(analysisProps, {
                        result,
                        childName
                      });
                    }
                  }
                }
              });
            }
          }
        } else if (name === 'methods') {
          const properties = node.properties;
          if (properties.length > 0) {
            result.methods = [].concat(properties);
          }
        }
      }
    }
  });

  return result;
};

const genConstructor = (path, state) => {
  const blocks = [
    t.expressionStatement(
      t.callExpression(
        t.super(),
        [t.identifier('props')]
      )
    )
  ];

  if (state._statements && state._statements.length > 0) {
    let propArr = [];
    state._statements.forEach(node => {
      if (t.isObjectProperty(node)) {
        // state.key = value;
        // let nodeStatement = t.expressionStatement(
        //   t.assignmentExpression('=', t.memberExpression(
        //       t.identifier('state'),
        //       t.identifier(node.key.name)
        //     ), t.isBooleanLiteral(node.value) ?
        //     t.booleanLiteral(node.value.value) :
        //     t.stringLiteral(node.value.value)
        //   )
        // );

        // state = { key: value };
        propArr.push(t.objectProperty(
          t.stringLiteral(node.key.name),
          t.isBooleanLiteral(node.value) ?
          t.booleanLiteral(node.value.value) :
          t.stringLiteral(node.value.value)
        ))
      }
    });

    let nodeStatement = t.expressionStatement(
      t.assignmentExpression('=', t.identifier('state'),
        t.objectExpression(propArr)
      )
    );
    blocks.push(nodeStatement);
  }

  const constructor = t.classMethod(
    'constructor', // kind
    t.identifier('constructor'), // 方法名
    [t.identifier('props')], // 参数
    t.blockStatement(blocks) // body
  );
  path.node.body.push(constructor);
};

const genMethods = (path, arr) => {
  const methods = [];

  if (arr.length > 0) {
    arr.forEach(node => {
      methods.push(t.classMethod(
        'method',
        t.identifier(node.key.name),
        node.params,
        node.body
      ))
    });
  }

  path.node.body = path.node.body.concat(methods);
};

const genCycle = (path, arr) => {
  const cycles = [];

  if (arr.length > 0) {
    arr.forEach(node => {
      cycles.push(t.classMethod(
        'method',
        t.identifier(cycle[node.key.name]),
        [],
        node.body
      ))
    });
  }

  path.node.body = path.node.body.concat(cycles);
};

module.exports = {
  parseScript,
  genConstructor,
  genMethods,
  genCycle
};