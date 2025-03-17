import React, { useState, useContext } from 'react';
import { Form, Input, Button, message } from 'antd';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { AuthContext } from '../../contexts/AuthContext';

const AddSongForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { addSong, currentSession } = useContext(PlaylistContext);
  const { username, setUserName } = useContext(AuthContext);

  const handleSubmit = async (values) => {
    if (!currentSession) {
      message.error('Không có phiên phát nhạc nào đang diễn ra');
      return;
    }

    // Cập nhật username nếu người dùng nhập
    if (values.username && values.username !== username) {
      setUserName(values.username);
    }

    try {
      setLoading(true);
      const success = await addSong(values.youtubeUrl, values.message);
      if (success) {
        form.resetFields(['youtubeUrl', 'message']);
      }
    } catch (error) {
      console.error('Error adding song:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentSession) {
    return <div>Hiện tại không có phiên phát nhạc nào đang diễn ra</div>;
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ username }}>
      <Form.Item
        name="username"
        label="Tên của bạn"
        rules={[{ required: true, message: 'Vui lòng nhập tên của bạn' }]}
      >
        <Input placeholder="Nhập tên của bạn" />
      </Form.Item>
      
      <Form.Item
        name="youtubeUrl"
        label="Link YouTube"
        rules={[
          { required: true, message: 'Vui lòng nhập link YouTube' },
          { 
            pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
            message: 'Vui lòng nhập link YouTube hợp lệ'
          }
        ]}
      >
        <Input placeholder="https://www.youtube.com/watch?v=..." />
      </Form.Item>
      
      <Form.Item
        name="message"
        label="Lời nhắn (sẽ được đọc trước khi phát nhạc)"
      >
        <Input.TextArea rows={3} placeholder="Nhập lời nhắn của bạn..." />
      </Form.Item>
      
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Thêm vào playlist
        </Button>
      </Form.Item>
    </Form>
  );
};

export default AddSongForm; 