export interface MaskProps {
  children?: any;
  onClick?: () => void;
}

function Mask(props: MaskProps) {
  const { children, onClick } = props;
  return (
    <div className="blocky-example-mask" onClick={onClick}>
      {children}
    </div>
  );
}

export default Mask;
