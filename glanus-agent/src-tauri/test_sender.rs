use webrtc::rtp_transceiver::rtp_sender::RTCRtpSender;
fn test(sender: &RTCRtpSender) {
    let _ = sender.read(&mut []);
}
