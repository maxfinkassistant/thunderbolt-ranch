import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, ScrollRestoration, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import HowItWorks from "./pages/HowItWorks";
import Order from "./pages/Order";
import Split from "./pages/Split";
import GroupPage from "./pages/Group";
import Track from "./pages/Track";
import "./styles/global.css";

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Layout />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/how-it-works", element: <HowItWorks /> },
      { path: "/order", element: <Order /> },
      { path: "/split", element: <Split /> },
      { path: "/split/:code", element: <GroupPage /> },
      { path: "/track", element: <Track /> },
      { path: "/track/:code", element: <Track /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
