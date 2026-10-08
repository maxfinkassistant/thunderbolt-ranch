import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider, ScrollRestoration, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import HowItWorks from "./pages/HowItWorks";
import Order from "./pages/Order";
import Track from "./pages/Track";
import Customers from "./pages/Customers";
import CustomerTicket from "./pages/CustomerTicket";
import Confirm from "./pages/Confirm";
import Booked from "./pages/Booked";
import "./styles/global.css";

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Layout />
    </>
  );
}

const routes = [
  {
    element: <Root />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/how-it-works", element: <HowItWorks /> },
      { path: "/order", element: <Order /> },
      { path: "/order/confirmed/:code", element: <Booked /> },
      { path: "/track", element: <Track /> },
      { path: "/track/:code", element: <Track /> },
      { path: "/confirm/:code", element: <Confirm /> },
      { path: "/customers", element: <Customers /> },
      { path: "/customers/ticket/:code", element: <CustomerTicket /> },
    ],
  },
];

// Hash routing in production (GitHub Pages has no SPA fallback) and when
// opened as a file; clean URLs on the dev server.
const router =
  import.meta.env.PROD || window.location.protocol === "file:"
    ? createHashRouter(routes)
    : createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
