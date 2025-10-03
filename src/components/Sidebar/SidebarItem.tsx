import './SidebarItem.css';

interface SidebarItemProps {
  id: string;
  icon: string;
  alt: string;
  text: string;
  isActive: boolean;
  onClick: (id: string) => void;
}

const SidebarItem = ({ id, icon, alt, text, isActive, onClick }: SidebarItemProps) => {
  return (
    <a 
      id={id}
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
    >
      <img src={icon} alt={alt} />
      <span>{text}</span>
    </a>
  );
};

export default SidebarItem;
