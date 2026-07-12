import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function NotFound() {
  return (
    <Layout title="Page not found" description="The requested Sketchblock page could not be found.">
      <main className="container margin-vert--xl">
        <p className="hero__subtitle">404</p>
        <h1>That board is out of frame.</h1>
        <p>The page may have moved while Sketchblock was being updated.</p>
        <Link className="button button--primary" to="/">
          Return home
        </Link>
      </main>
    </Layout>
  );
}
