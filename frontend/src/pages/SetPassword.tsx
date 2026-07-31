// The invite / set-password flow was removed: carriers authenticate with their
// existing Peeredge credentials. This stub keeps old links working by redirecting
// to sign-in, and can be deleted (`git rm`) once no links point here.
import { Navigate } from 'react-router-dom';

export function SetPassword() {
  return <Navigate to="/login" replace />;
}
