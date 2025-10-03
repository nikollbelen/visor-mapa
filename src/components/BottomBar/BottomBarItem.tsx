import './BottomBarItem.css';

interface BottomBarItemProps {
  id: string;
  icon: string;
  alt: string;
  isActive: boolean;
  onClick: (id: string) => void;
}

const BottomBarItem = ({ id, icon, alt, isActive, onClick }: BottomBarItemProps) => {
  return (
    <button 
      id={id}
      className={`bottombar-icon-button ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
    >
      <img src={icon} alt={alt} />
    </button>
  );
};

export default BottomBarItem;
