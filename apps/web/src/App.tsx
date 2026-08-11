import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import {
  ProjectsPage,
} from "./pages/ProjectsPage";

import {
  RunDetailPage,
} from "./pages/RunDetailPage";

import {
  RunsPage,
} from "./pages/RunsPage";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to="/projects"
            replace
          />
        }
      />

      <Route
        path="/projects"
        element={<ProjectsPage />}
      />

      <Route
        path="/runs"
        element={<RunsPage />}
      />

      <Route
        path="/runs/:owner/:repo"
        element={<RunsPage />}
      />

      <Route
        path="/runs/:owner/:repo/:runId"
        element={<RunDetailPage />}
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/projects"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;