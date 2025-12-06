import ProfileInspectorModal from '@/components/study/ProfileInspectorModal';
import { TimelinePerson } from '@/types/timeline';

interface PersonModalProps {
  slug: string | null;
  open: boolean;
  onClose: () => void;
  fallbackPerson?: TimelinePerson | null;
}

// Wrapper to reuse the same modal as в bookshelf (HTML allowlist p,h2,h3,ul,li,blockquote,img,small,a)
// hideWorkSection: персоналии без блока произведения
export function PersonModal({ slug, open, onClose }: PersonModalProps) {
  return (
    <ProfileInspectorModal
      slug={slug}
      open={open}
      onClose={onClose}
      hideWorkSection
    />
  );
}
