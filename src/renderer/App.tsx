import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/base.css';
import TodoApp from './features/todos/components/TodoApp'

function Content() {
  return (
    <>
      <div className="drag-region" />
      <TodoApp />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={ <Content /> } />
      </Routes>
    </Router>
  );
}
