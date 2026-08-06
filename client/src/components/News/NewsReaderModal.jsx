import React, { Suspense, lazy, useState } from 'react';
import { Modal, Tabs } from 'antd';

const VnExpressNewsView = lazy(() => import('../VnExpressNews/VnExpressNewsView'));
const TechNewsWidget = lazy(() => import('../TechNews/TechNewsWidget'));

/**
 * Trang đọc tin toàn màn hình.
 *
 * Widget ở cột phải chỉ rộng 340px nên chỉ hợp để liếc; ai muốn đọc thật thì
 * mở modal này — cùng nguồn tin nhưng bày thành lưới tạp chí nhiều cột.
 */
const NewsReaderModal = ({ open, onClose, defaultTab = '1' }) => {
  const [tab, setTab] = useState(defaultTab);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      width="min(1180px, 94vw)"
      centered
      className="news-modal"
      destroyOnHidden
    >
      <div className="news-reader">
        <header className="news-reader__head">
          <div>
            <h2 className="news-reader__title">
              <span aria-hidden="true">🌍</span>
              Thế giới có gì mới?
            </h2>
            <span className="news-reader__sub">
              Tin nổi bật trong ngày và tin công nghệ, cập nhật liên tục
            </span>
          </div>
        </header>

        <div className="news-reader__body">
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                label: 'Tin nổi bật',
                key: '1',
                children:
                  tab === '1' ? (
                    <Suspense fallback={null}>
                      <VnExpressNewsView variant="reader" />
                    </Suspense>
                  ) : null,
              },
              {
                label: 'Tech News',
                key: '2',
                children:
                  tab === '2' ? (
                    <Suspense fallback={null}>
                      <TechNewsWidget variant="reader" />
                    </Suspense>
                  ) : null,
              },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
};

export default NewsReaderModal;
