import { BrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProcessorPage } from "./pages/ProcessorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ProcessorPage />
      </Layout>
    </BrowserRouter>
  );
}
