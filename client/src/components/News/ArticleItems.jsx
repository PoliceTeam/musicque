import React, { useState } from 'react';
import { formatAbsoluteTime, formatRelativeTime, isFresh } from '../../utils/newsTime';

/*
 * Các kiểu hiển thị một bài báo, dùng chung cho cả VnExpress lẫn Tech News.
 * Hai widget khác nguồn nhưng cùng một ngôn ngữ thị giác: hero cho tin dẫn,
 * hàng gọn cho cột phải, thẻ lưới cho trang đọc toàn màn hình.
 */

/**
 * Ảnh có tồn tại không, tính cả trường hợp link chết.
 *
 * Feed công nghệ (Lobsters, HN) hay đưa media:content trỏ vào ảnh 404 — cứ
 * render thẳng thì được một ô xám to đùng với icon ảnh vỡ. Ở đây coi ảnh hỏng
 * đúng như không có ảnh: bố cục tự chuyển sang dạng chỉ có chữ.
 */
const useArticleImage = (imageUrl) => {
  const [broken, setBroken] = useState(false);
  return {
    hasImage: Boolean(imageUrl) && !broken,
    onError: () => setBroken(true),
  };
};

export const ArticleMeta = ({ article }) => (
  <>
    {isFresh(article.pubDate) && <span className="news-badge">Mới</span>}
    {article.source && <span className="news-tag">{article.source}</span>}
    <span>{formatRelativeTime(article.pubDate)}</span>
  </>
);

/** Tin mới nhất: ảnh lớn, tiêu đề đè lên ảnh. */
export const HeroArticle = ({ article }) => {
  const { hasImage, onError } = useArticleImage(article.imageUrl);

  return (
    <a
      className={`news-item news-hero${hasImage ? '' : ' news-hero--flat'}`}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      title={formatAbsoluteTime(article.pubDate)}
    >
      {hasImage && (
        <img
          className="news-hero__img"
          src={article.imageUrl}
          alt=""
          loading="lazy"
          onError={onError}
        />
      )}
      <div className="news-hero__veil" />
      <div className="news-hero__body">
        <h3 className="news-hero__title">{article.title}</h3>
        <div className="news-hero__meta">
          <ArticleMeta article={article} />
        </div>
      </div>
    </a>
  );
};

/** Hàng gọn cho cột phải — nhìn thấy được nhiều tin trong cùng khoảng trống. */
export const RowArticle = ({ article }) => {
  const { hasImage, onError } = useArticleImage(article.imageUrl);

  return (
    <a
      className="news-item news-row"
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      title={formatAbsoluteTime(article.pubDate)}
    >
      {hasImage ? (
        <img
          className="news-row__thumb"
          src={article.imageUrl}
          alt=""
          loading="lazy"
          onError={onError}
        />
      ) : (
        <div className="news-row__thumb news-row__thumb--empty" aria-hidden="true">
          📰
        </div>
      )}
      <div className="news-row__body">
        <h4 className="news-row__title">{article.title}</h4>
        <div className="news-row__meta">
          <ArticleMeta article={article} />
        </div>
      </div>
    </a>
  );
};

/** Thẻ trong lưới tạp chí của NewsReaderModal. */
export const CardArticle = ({ article, lead = false }) => {
  const { hasImage, onError } = useArticleImage(article.imageUrl);

  return (
    <a
      className={`news-card${lead ? ' news-card--lead' : ''}${hasImage ? '' : ' news-card--text'}`}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      title={formatAbsoluteTime(article.pubDate)}
    >
      {hasImage && (
        <div className="news-card__media">
          <img
            className="news-card__img"
            src={article.imageUrl}
            alt=""
            loading="lazy"
            onError={onError}
          />
        </div>
      )}
      <div className="news-card__body">
        <h3 className="news-card__title">{article.title}</h3>
        {article.summary && <p className="news-card__summary">{article.summary}</p>}
        <div className="news-card__meta">
          <ArticleMeta article={article} />
        </div>
      </div>
    </a>
  );
};

export const RailSkeleton = ({ hero = true }) => (
  <div className="news-skeleton">
    {hero && <div className="news-skeleton__block" style={{ aspectRatio: '16 / 10' }} />}
    {[1, 2, 3, 4].map((i) => (
      <div key={i} style={{ display: 'flex', gap: 10, padding: 8 }}>
        <div className="news-skeleton__block" style={{ width: 72, height: 56, flex: '0 0 auto' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="news-skeleton__block" style={{ height: 12 }} />
          <div className="news-skeleton__block" style={{ height: 12, width: '75%' }} />
          <div className="news-skeleton__block" style={{ height: 10, width: '40%' }} />
        </div>
      </div>
    ))}
  </div>
);

export const GridSkeleton = () => (
  <div className="news-grid">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="news-card" style={{ pointerEvents: 'none' }}>
        <div className="news-skeleton__block" style={{ aspectRatio: '16 / 9' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px 4px' }}>
          <div className="news-skeleton__block" style={{ height: 14 }} />
          <div className="news-skeleton__block" style={{ height: 14, width: '70%' }} />
          <div className="news-skeleton__block" style={{ height: 11, width: '45%' }} />
        </div>
      </div>
    ))}
  </div>
);

/** Trạng thái lỗi/rỗng dùng chung. */
export const NewsState = ({ message, onRetry }) => (
  <div className="news-state">
    <span>{message}</span>
    {onRetry && (
      <button type="button" className="news-expand" onClick={onRetry}>
        Thử lại
      </button>
    )}
  </div>
);
