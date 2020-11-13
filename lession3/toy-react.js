// 定义一个私有属性
const RENDER_TO_DOM = Symbol('render to dom')
export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
    this._range = null
  }
  setAttribute(name, value) {
    this.props[name] = value
  }
  appendChild(component) {
    this.children.push(component)
  }
  get vdom() {
    return this.render().vdom
  }
  [RENDER_TO_DOM](range) {
    this._range = range
    this._vdom = this.vdom
    this._vdom[RENDER_TO_DOM](range)
  }
  update() {
    let isSameNode = (oldNode, newNode) => {
      // type 不同则直接不同
      if (oldNode.type !== newNode.type) {
        return false
      }
      // props 的名字不同，则认为不同
      for (let name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) {
          return false
        }
      }
      // 新旧节点的props 数量不同，则不同
      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length) {
        return false
      }

      // 文本节点
      if (newNode.type === '#text') {
        if (newNode.content !== oldNode.content) {
          return false
        }
      }
      return true
    }
    // 递归访问
    let update = (oldNode, newNode) => {
      // type 不同，则事完全不同的
      // props 不同，可以通过 patch 去对比，这里认为 props 不同也是完全不同
      // children
      // #text 的 content 不同，可以通过 patch 去对比，这里认为 content 不同也是完全不同
      if (!isSameNode(oldNode, newNode)) {
        // 直接替换
        newNode[RENDER_TO_DOM](oldNode._range)
        return
      }
      newNode._range = oldNode._range

      let newChildren = newNode.vchildren
      let oldChildren = oldNode.vchildren

      if (!newChildren || !newChildren.length) {
        return
      }

      let tailRange = oldChildren[oldChildren.length - 1]._range

      for (let i = 0;i < newChildren.length;i ++) {
        let newChild = newChildren[i]
        let oldChild = oldChildren[i]
        if (i < oldChildren.length) {
          update(oldChild, newChild)
        } else {
          // TODO
          let range = document.createRange()
          range.setStart(tailRange.endContainer, tailRange.endOffset)
          range.setEnd(tailRange.endContainer, tailRange.endOffset)
          newChild[RENDER_TO_DOM](range)
          tailRange = range
        }
      }
    }
    
    let vdom = this.vdom
    update(this._vdom, vdom)
    this._vdom = vdom
  }
  /*rerender() {
    // range 删除后产生全空的一个range，如果它有相邻的 range，就能被吞进去，吞到下一个range，再插入它紧脏周总后边的 range 包含进去，所以在插入的时候要保证这个range 是非空的
    let oldRange = this._range
    let range = window.document.createRange()
    range.setStart(oldRange.startContainer, oldRange.startOffset)
    range.setEnd(oldRange.startContainer, oldRange.startOffset)
    this[RENDER_TO_DOM](range)
    oldRange.setStart(range.endContainer, range.endOffset)
    oldRange.deleteContents()
  }*/
  setState(newState) {
    // 递归实现
    // 深拷贝
    // 但此时的更新还是全局更新，没有实现单独数据更新
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState
      this.rerender()
      return;
    }
    let merge = function (oldState, newState) {
      for (let p in newState) {
        if (oldState[p] === null || typeof oldState[p] !== 'object') {
          oldState[p] = newState[p]
        } else {
          merge(oldState[p], newState[p])
        }
      }
    }
    merge(this.state, newState)
    this.update()
  }
}

class ElementWrapper extends Component {
  constructor(type) {
    super(type)
    this.type = type
  }
  get vdom() {
    this.vchildren = this.children.map(child => child.vdom)
    return this
  }
  [RENDER_TO_DOM](range) {
    this._range = range

    let root = document.createElement(this.type)

    for (let name in this.props) {
      let value = this.props[name]
      if (name.match(/^on([\s\S]+)$/)) {
        root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value)
      } else {
        // 以 className 命名的，需要处理为 class 名字
        if (name === 'className') {
          root.setAttribute('class', value)
        } else {
          root.setAttribute(name, value)
        }
      }
    }
    
    if (!this.vchildren) {
      this.vchildren = this.children.map(child => child.vdom)
    }

    for (let child of this.children) {
      let childRange = document.createRange()
      childRange.setStart(root, root.childNodes.length)
      childRange.setEnd(root, root.childNodes.length)
      child[RENDER_TO_DOM](childRange)
    }
    
    replaceContent(range, root)
  }
}

class TextWrapper extends Component {
  constructor(content) {
    super(content)
    this.content = content
  }
  get vdom() {
    return this
  }
  [RENDER_TO_DOM](range) {
    this._range = range
    let root = document.createTextNode(this.content)
    replaceContent(range, root)
  }
}

function replaceContent (range, node) {
  range.insertNode(node)
  range.setStartAfter(node)
  range.deleteContents()

  range.setStartBefore(node)
  range.setEndAfter(node)
}

export function createElement(type, attrbutes, ...children) {
  let e
  if (typeof type === 'string') {
    e = new ElementWrapper(type)
  } else {
    e = new type
  }
  for (let p in attrbutes) {
    e.setAttribute(p, attrbutes[p])
  }
  let insertChildren = (children) => {
    for (let child of children) {
      if (typeof child === 'string') {
        child = new TextWrapper(child)
      }
      // 如果某一个 child 是 null，则不处理
      if (child === null) {
        continue
      }
      if ((typeof child === 'object') && (child instanceof Array)) {
        insertChildren(child)
      } else {
        e.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return e
}

export function render(component, parentElement) {
  let range = document.createRange()
  range.setStart(parentElement, 0)
  range.setEnd(parentElement, parentElement.childNodes.length)
  range.deleteContents()
  component[RENDER_TO_DOM](range)
}
