Table users {
  id uuid [pk]
  phonenumber varchar [unique, not null]
  password varchar [not null]

  username varchar
  avatar varchar
  cover_image varchar // Ảnh bìa
  description text // Giới thiệu bản thân

  role enum('HV','GV') [not null]

  token varchar

  status enum('ACTIVE','LOCKED') [default: 'ACTIVE']

  online boolean [default: false]

  created_at datetime
  updated_at datetime
}


Table blocks {
  blocker_id uuid
  blocked_id uuid

  indexes {
    (blocker_id, blocked_id) [pk]
  }
}


Table enrollments {
  id uuid [pk]

  student_id uuid
  teacher_id uuid

  status enum('PENDING','ACCEPTED','REJECTED')

  created_at datetime
}


Table posts {
  id uuid [pk]

  author_id uuid

  described text

  course_id uuid // null nếu GV đăng bài thường
  exercise_id uuid // null nếu GV đăng bài thường

  time_series_poses json // Pose của GV để HV đối sánh

  can_comment boolean [default: true]
  can_edit boolean [default: true]

  is_banned boolean [default: false]

  created_at datetime
  updated_at datetime
}



Table reports {
  id uuid [pk]

  user_id uuid
  post_id uuid

  subject varchar
  details text

  created_at datetime
}



Table post_videos {
  id uuid [pk]

  post_id uuid

  url varchar
  thumb varchar
}



Table likes {
  id uuid [pk]

  user_id uuid
  post_id uuid

  created_at datetime

  indexes {
    (user_id, post_id) [unique]
  }
}



Table comments {
  id uuid [pk]

  user_id uuid
  post_id uuid

  content text

  score float
  detail_mistake text

  created_at datetime
}



Table conversations {
  id uuid [pk]

  partner_a_id uuid
  partner_b_id uuid

  is_deleted boolean [default: false]

  created_at datetime

  indexes {
    (partner_a_id, partner_b_id) [unique]
  }
}



Table messages {
  id uuid [pk]

  conversation_id uuid

  sender_id uuid
  receiver_id uuid

  content text

  is_read boolean [default: false]

  is_deleted boolean [default: false]

  created_at datetime
}



Table devices {
  id uuid [pk]

  user_id uuid
  dev_token varchar

  indexes {
    (user_id, dev_token) [unique]
  }
}



Table push_settings {

  user_id uuid [pk]

  like_comment boolean [default: true]
  from_friends boolean [default: true]

  requested_friend boolean [default: true]
  suggested_friend boolean [default: true]

  birthday boolean [default: true]
  video boolean [default: true]
  report boolean [default: true]

  sound_on boolean [default: true]
  notification_on boolean [default: true]

  vibrant_on boolean [default: true]
  led_on boolean [default: true]
}



Table notifications {
  id uuid [pk]

  user_id uuid

  type varchar
  object_id uuid

  title varchar
  avatar varchar

  group_type int

  is_read boolean [default: false]

  created_at datetime
}



Table search_history {
  id uuid [pk]

  user_id uuid

  keyword varchar

  created_at datetime
}




Ref: blocks.blocker_id > users.id
Ref: blocks.blocked_id > users.id

Ref: enrollments.student_id > users.id
Ref: enrollments.teacher_id > users.id

Ref: posts.author_id > users.id


Ref: reports.user_id > users.id
Ref: reports.post_id > posts.id


Ref: post_videos.post_id > posts.id


Ref: likes.user_id > users.id
Ref: likes.post_id > posts.id


Ref: comments.user_id > users.id
Ref: comments.post_id > posts.id


Ref: conversations.partner_a_id > users.id
Ref: conversations.partner_b_id > users.id


Ref: messages.conversation_id > conversations.id
Ref: messages.sender_id > users.id
Ref: messages.receiver_id > users.id


Ref: devices.user_id > users.id


Ref: push_settings.user_id > users.id


Ref: notifications.user_id > users.id


Ref: search_history.user_id > users.id