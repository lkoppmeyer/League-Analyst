import { Routes, Route, Navigate } from 'react-router-dom';
import SearchView from './components/SearchView';
import MatchView from './components/MatchView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchView />} />
      <Route path="/match/:matchId" element={<MatchView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
