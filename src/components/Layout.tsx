import { NavLink, Link, Outlet } from "react-router-dom";
import { RANCH_CONTACT, PROCESSOR, PAYABLE_TO, ASSET } from "../data/config";

export default function Layout() {
  return (
    <>
      <div className="site-banner">
        OCTOBER 2026 HARVEST — ORDER BY <b>SEPTEMBER 30</b> · PICKUP AT COLORADO CUSTOM MEAT CO, KERSEY
      </div>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Thunderbolt Ranch home" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img className="brand-logo" src={ASSET("thunderbolt-mark.png")} alt="" />
          <span>
            <span className="brand-name" style={{ display: "block" }}>Thunderbolt Ranch</span>
            <span className="brand-sub" style={{ display: "block" }}>RANCH TO TABLE · COLORADO</span>
          </span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/track">Track my order</NavLink>
          <Link to="/order" className="btn btn-solid nav-cta">Order beef</Link>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div>THUNDERBOLT RANCH · CALL OR TEXT {RANCH_CONTACT.name.toUpperCase()} {RANCH_CONTACT.phone}</div>
        <div>PICKUP: {PROCESSOR.name.toUpperCase()} · {PROCESSOR.address.toUpperCase()}</div>
        <div>CHECKS PAYABLE TO {PAYABLE_TO.toUpperCase()}</div>
        <div><Link to="/customers">RANCH OFFICE</Link></div>
      </footer>
    </>
  );
}
