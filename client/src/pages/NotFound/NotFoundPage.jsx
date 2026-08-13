import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="text-center">
    <h1 className="text-5xl font-black">404</h1>
    <p className="mt-2 text-slate-600">The page you are looking for does not exist.</p>
    <Link to="/" className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2 text-white">Go Home</Link>
  </div>
);

export default NotFoundPage;
