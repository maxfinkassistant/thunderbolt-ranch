import { NavLink, Link, Outlet } from "react-router-dom";
import { RANCH_PHONE, PROCESSOR } from "../data/config";

export default function Layout() {
  return (
    <>
      <div className="site-banner">
        PICKUP ONLY AT <b>COLORADO CUSTOM MEAT CO · KERSEY, CO</b> — WE DO NOT SHIP
      </div>
      <header className="site-header">
        <Link to="/" className="brand">
          <div className="brand-name">Thunderbolt Ranch</div>
          <div className="brand-sub">BULK BEEF · NORTHEAST COLORADO</div>
        </Link>
        <nav className="site-nav">
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/split">Split a cow</NavLink>
          <NavLink to="/track">Track my order</NavLink>
          <Link to="/order" className="btn btn-solid nav-cta">Reserve beef</Link>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div>THUNDERBOLT RANCH · BEEF QUESTIONS {RANCH_PHONE}</div>
        <div>PICKUP &amp; PROCESSING: {PROCESSOR.name.toUpperCase()} {PROCESSOR.phone}</div>
        <div>{PROCESSOR.address.toUpperCase()}</div>
        <div><Link to="/customers">RANCH OFFICE</Link></div>
      </footer>
    </>
  );
}
