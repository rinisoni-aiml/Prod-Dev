import { GraduationCap } from 'lucide-react';
import SectionPage from '@/industries/education/components/SectionPage';

export default function PlacementsPage() {
  return (
    <SectionPage
      section="placements"
      title="Placements"
      description="Student placement and career outcome analytics"
      icon={GraduationCap}
    />
  );
}