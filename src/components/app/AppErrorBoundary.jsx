import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError)
      return (
        <div className="p-8 text-center text-red-500">
          Ошибка UI{' '}
          <button onClick={this.props.onReset} className="ml-2 underline">
            Сброс
          </button>
        </div>
      );

    return this.props.children;
  }
}
