import { observer } from 'mobx-react-lite';
import Dialog from '../shared_ui/dialog';
import Scanner from '../../pages/scanner';
import './floating-scanner.scss';

interface FloatingScannerProps {
    is_open: boolean;
    onClose: () => void;
}

const FloatingScanner = observer(({ is_open, onClose }: FloatingScannerProps) => {
    return (
        <Dialog
            className='floating-scanner__dialog'
            is_visible={is_open}
            onCancel={onClose}
            has_close_icon={true}
            title='AI Scanner'
            is_mobile_full_width={false}
        >
            <div className='floating-scanner__content'>
                <Scanner />
            </div>
        </Dialog>
    );
});

export default FloatingScanner;
