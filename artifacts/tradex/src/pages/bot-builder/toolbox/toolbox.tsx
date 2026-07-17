import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { LabelPairedChevronDownMdFillIcon, LabelPairedCircleXmarkMdRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import ToolbarButton from '../toolbar/toolbar-button';
import SearchBox from './search-box';
import { ToolboxItems } from './toolbox-items';

const Toolbox = observer(() => {
    const { isDesktop } = useDevice();
    const { toolbox, flyout, quick_strategy } = useStore();
    const {
        hasSubCategory,
        is_search_loading,
        onMount,
        onSearchBlur,
        onSearchClear,
        onSearchKeyUp,
        onToolboxItemClick,
        onToolboxItemExpand,
        onUnmount,
        sub_category_index,
        toolbox_dom,
    } = toolbox;

    const { setFormVisibility } = quick_strategy;
    const { setVisibility, selected_category } = flyout;

    const toolbox_ref = React.useRef(ToolboxItems());
    const [is_open, setOpen] = React.useState(true);
    const [is_mobile_toolbox_open, setMobileToolboxOpen] = React.useState(false);
    const [pending_selection] = React.useState<string | null>(null);

    React.useEffect(() => {
        onMount(toolbox_ref);
        return () => onUnmount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleQuickStrategyOpen = () => {
        setFormVisibility(true);
        /* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
        /* [/AI] */
    };

    const handleMobileCategoryClick = (category: HTMLElement) => {
        onToolboxItemClick(category);
        setMobileToolboxOpen(false);
    };

    const handleMobileSubCategoryClick = (subCategory: HTMLElement) => {
        onToolboxItemClick(subCategory);
        setMobileToolboxOpen(false);
    };

    const category_menu = (on_category_click: (c: HTMLElement) => void, on_sub_category_click: (c: HTMLElement) => void) => (
        <div className='db-toolbox__category-menu'>
            {toolbox_dom &&
                Array.from(toolbox_dom.childNodes as HTMLElement[]).map((category, index) => {
                    if (category.tagName.toUpperCase() === 'CATEGORY') {
                        const category_id = category.getAttribute('id');
                        const has_sub_category = hasSubCategory(category.children);
                        const is_sub_category_open = sub_category_index.includes(index);
                        return (
                            <React.Fragment key={`db-toolbox__row--${category_id}`}>
                                <div
                                    className={classNames('db-toolbox__row', {
                                        'db-toolbox__row--active':
                                            selected_category?.getAttribute('id') === category?.id,
                                        'db-toolbox__row--pending':
                                            pending_selection === category?.getAttribute('id'),
                                    })}
                                >
                                    <div
                                        className='db-toolbox__item'
                                        onClick={() => {
                                            // eslint-disable-next-line no-unused-expressions
                                            has_sub_category
                                                ? onToolboxItemExpand(index)
                                                : on_category_click(category);
                                        }}
                                    >
                                        <div className='db-toolbox__category-text'>
                                            <div className='db-toolbox__label'>
                                                {localize(category.getAttribute('name') as string)}
                                            </div>
                                            {has_sub_category && (
                                                <div
                                                    className={classNames('db-toolbox__category-arrow', {
                                                        'db-toolbox__category-arrow--active':
                                                            is_sub_category_open,
                                                    })}
                                                >
                                                    <LabelPairedChevronDownMdFillIcon fill='var(--text-general)' />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {has_sub_category &&
                                        is_sub_category_open &&
                                        (Array.from(category.childNodes) as HTMLElement[]).map(subCategory => {
                                            return (
                                                <div
                                                    key={`db-toolbox__sub-category-row--${subCategory.getAttribute('id')}`}
                                                    className={classNames('db-toolbox__sub-category-row', {
                                                        'db-toolbox__sub-category-row--active':
                                                            selected_category?.getAttribute('id') === subCategory?.id,
                                                        'db-toolbox__sub-category-row--pending':
                                                            pending_selection === subCategory?.getAttribute('id'),
                                                    })}
                                                    onClick={() => {
                                                        on_sub_category_click(subCategory);
                                                    }}
                                                >
                                                    <Text size='xxs'>{subCategory.getAttribute('name') as string}</Text>
                                                </div>
                                            );
                                        })}
                                </div>
                            </React.Fragment>
                        );
                    }
                    return null;
                })}
        </div>
    );

    if (isDesktop) {
        return (
            <div className='db-toolbox' data-testid='dashboard__toolbox'>
                <ToolbarButton
                    popover_message={localize('Click here to start building your Deriv Bot.')}
                    button_id='db-toolbar__get-started-button'
                    button_classname='toolbar__btn toolbar__btn--icon toolbar__btn--start'
                    buttonOnClick={handleQuickStrategyOpen}
                    button_text={localize('Quick strategy')}
                />
                <div id='gtm-toolbox' className='db-toolbox__content'>
                    <div className='db-toolbox__header'>
                        <div
                            className='db-toolbox__title'
                            data-testid='db-toolbox__title'
                            onClick={() => {
                                setOpen(!is_open);
                                setVisibility(false);
                            }}
                        >
                            {localize('Blocks menu')}
                            <span
                                className={classNames('db-toolbox__title__chevron', {
                                    'db-toolbox__title__chevron--active': is_open,
                                })}
                            >
                                <LabelPairedChevronDownMdFillIcon fill='var(--text-general)' />
                            </span>
                        </div>
                    </div>
                    <div
                        className={classNames('db-toolbox__content-wrapper', { active: is_open })}
                        data-testid='db-toolbox__content-wrapper'
                    >
                        <SearchBox
                            is_search_loading={is_search_loading}
                            onSearch={toolbox.onSearch}
                            onSearchBlur={onSearchBlur}
                            onSearchClear={onSearchClear}
                            onSearchKeyUp={onSearchKeyUp}
                        />
                        {category_menu(onToolboxItemClick, onToolboxItemClick)}
                    </div>
                </div>
            </div>
        );
    }

    // ── Mobile: floating trigger + slide-in panel ─────────────────────────
    return (
        <>
            <button
                type='button'
                className='db-toolbox__mobile-trigger'
                data-testid='db-toolbox__mobile-trigger'
                onClick={() => setMobileToolboxOpen(true)}
            >
                <span className='db-toolbox__mobile-trigger-icon' aria-hidden='true'>
                    ☰
                </span>
                {localize('Blocks')}
            </button>

            {is_mobile_toolbox_open && (
                <div className='db-toolbox__mobile-overlay' onClick={() => setMobileToolboxOpen(false)}>
                    <div
                        className='db-toolbox__mobile-panel'
                        onClick={e => e.stopPropagation()}
                        data-testid='db-toolbox__mobile-panel'
                    >
                        <div className='db-toolbox__mobile-panel-header'>
                            <Text weight='bold'>{localize('Blocks menu')}</Text>
                            <button
                                type='button'
                                className='db-toolbox__mobile-close'
                                onClick={() => setMobileToolboxOpen(false)}
                            >
                                <LabelPairedCircleXmarkMdRegularIcon fill='var(--text-general)' />
                            </button>
                        </div>
                        <SearchBox
                            is_search_loading={is_search_loading}
                            onSearch={toolbox.onSearch}
                            onSearchBlur={onSearchBlur}
                            onSearchClear={onSearchClear}
                            onSearchKeyUp={onSearchKeyUp}
                        />
                        {category_menu(handleMobileCategoryClick, handleMobileSubCategoryClick)}
                    </div>
                </div>
            )}
        </>
    );
});

export default Toolbox;