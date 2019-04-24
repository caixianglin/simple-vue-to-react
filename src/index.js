const fs = require('fs');
const path = require('path');
// SFC(single-file component or *.vue file)
const compiler = require('vue-template-compiler');
const parse = require('@babel/parser').parse;
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const jsMethod = require('./parse-script');
const templateMethod = require('./parse-template');
const generate = require('@babel/generator').default;

/**
 * vue-template-compiler提取vue代码里的template、style、script
 * @param file 
 * @return Object
 * { template: null,
 *  script: null,
 *  styles: [],
 *  customBlocks: [],
 *  errors: [] }
 */
function getSFCComponent(file) {
  let source = fs.readFileSync(path.resolve(__dirname, file));
  let result = compiler.parseComponent(source.toString(), {
    pad: "line"
  });
  let cssContent = '';
  result.styles.forEach(style => {
    cssContent += '' + style.content;
  })
  return {
    template: result.template.content.replace(/{{/g, '{').replace(/}}/g, '}'),
    js: result.script.content.replace(/\/\/.*/g, ''),
    css: cssContent
  };
}

let app = Object.create(null);
// 解析vue文件
let component = getSFCComponent('./source.vue');
// 复用style
app.style = component.css;
// 解析script
let script_ast = parse(component.js, {
  sourceType: 'module'
});
let jsObj = jsMethod.parseScript(script_ast);
app.script = {
  ast: script_ast,
  components: null,
  computed: null,
  data: jsObj.data,
  props: jsObj.props,
  methods: jsObj.methods,
  cycle: jsObj.cycle
};
// 解析template
const template_ast = parse(component.template, {
  sourceType: "module",
  plugins: ["jsx"]
});
const renderArgument = templateMethod.parseTemplate(template_ast, jsObj);

// vue->react
const tpl = `
import { createElement, Component } from  'React';
export default class myComponent extends Component {}
`;
const final_ast = parse(tpl, {
  sourceType: 'module'
});
traverse(final_ast, {
  ClassBody(path) {
    jsMethod.genConstructor(path, app.script.data)
    jsMethod.genMethods(path, app.script.methods)
    jsMethod.genCycle(path, app.script.cycle)
    templateMethod.genTemplate(path, renderArgument)
  }
});

const result = generate(final_ast);
console.log(result.code);

/**
 * 转换后react代码
import { createElement, Component } from 'React';
export default class myComponent extends Component {
  constructor(props) {
    super(props);
    state = {
      "show": true,
      "name": "name"
    };
  }

  handleClick() {}

  handleClick2(a, b) {
    comsole.log(1);
  }

  componentWillMount() {}

  componentDidMount() {
    console.log(this.state.name);
  }

  render() {
    return 
<div>
  <p className="title" onClick={this.handleClick}>{this.props.title}</p>
  {this.state.show ? 
  <p className="name">{this.state.name}</p> : null}
    
</div>;
  }

}
 */