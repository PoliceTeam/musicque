import React from 'react'

/**
 * Chặn lỗi không cho lan ra toàn bộ cây React.
 *
 * Cần thiết cho các phần render bằng WebGL: <Canvas> của react-three-fiber
 * cố tình ném lỗi ra ngoài ("Throw exception outwards if anything within
 * canvas throws"), nên nếu không chặn thì một lần tải model/HDR thất bại
 * sẽ làm trắng cả trang chứ không chỉ hỏng phần 3D.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export default ErrorBoundary
