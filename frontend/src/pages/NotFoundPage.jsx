import { Link } from 'react-router-dom';
import { Card } from '../components/ui.jsx';

export default function NotFoundPage() {
  return (
    <Card title="Page not found" sub="This route does not exist yet.">
      <p className="card-sub">
        Feature pages beyond authentication arrive in later tasks.
      </p>
      <Link to="/home">Go home →</Link>
    </Card>
  );
}
