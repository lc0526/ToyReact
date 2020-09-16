import { createElement, Component, render } from './toy-react.js'
class MyComponent extends Component {
  render() {
    return <div>
      <h1>Toy-react first lession！</h1>
      {this.children}
    </div>
  }
}
render(<MyComponent id="a" class="c">
  <div>实现一个自设定的 component</div>
  <div></div>
  <div></div>
</MyComponent>, window.document.body)
