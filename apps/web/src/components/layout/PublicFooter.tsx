import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div>
          <div>
            <img src="/logo.png" alt="Connect Hospital" className="h-10 w-auto object-contain" />
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Compare hospitals by cost, doctors and rating — then get a guided callback from a real person at the
            hospital.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Patients</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/search" className="hover:text-foreground">Find a hospital</Link></li>
            <li><Link to="/search" className="hover:text-foreground">Compare surgery costs</Link></li>
            <li><Link to="/login" className="hover:text-foreground">My enquiries</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Hospitals</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground">Register your hospital</Link></li>
            <li><Link to="/login" className="hover:text-foreground">Hospital dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Connect Hospital</h4>
          <p className="text-sm text-muted-foreground">Proof of Concept build. Pilot geography: Karnataka.</p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Connect Hospital. All rights reserved.
      </div>
    </footer>
  );
}
