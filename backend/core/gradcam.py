"""
GradCAM for MultimodalDetector - Visualizes which parts of the signal/video
contribute most to the distraction prediction.
"""
import torch
import numpy as np


class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate(self, sig_input, vid_input):
        self.model.eval()
        output = self.model(sig_input, vid_input)
        self.model.zero_grad()
        output.backward()
        weights = self.gradients.mean(dim=[0, 2])
        cam = (weights.unsqueeze(0).unsqueeze(2) * self.activations).sum(dim=1)
        cam = torch.relu(cam)
        cam = cam / (cam.max() + 1e-8)
        return cam.squeeze().numpy()