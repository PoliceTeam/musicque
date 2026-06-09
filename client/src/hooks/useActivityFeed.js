import { useEffect, useState } from 'react';
import { prependActivityItem } from '../utils/activityFeed';

const useActivityFeed = (socket) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleActivity = (event) => {
      setItems((prev) => prependActivityItem(prev, event));
    };

    socket.on('activity_event', handleActivity);

    return () => {
      socket.off('activity_event', handleActivity);
    };
  }, [socket]);

  const clearItems = () => setItems([]);

  return { items, clearItems };
};

export default useActivityFeed;
