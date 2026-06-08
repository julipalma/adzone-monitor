const uuidStorage = localStorage.getItem('uuid-arc') || '';
  const eventAuth = {
    event: 'authentication',
    userId: uuidStorage,
  };
  dataLayer = (uuidStorage !== '') ? [eventAuth] : [];