
## Flashing

`esptool --chip esp32 --port COM4 --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dout --flash_freq 40m --flash_size detect 0x1000 bootloader_dout_40m.bin 0x8000 partitions.bin 0xe000 boot_app0.bin 0x10000 .\tasmota32-display.bin`


## Configuration

gpio4 - i2c scl
gpio5 - i2c scl

DisplayText [f1p7x0y5] asdf

## Resources
https://tasmota.github.io/docs/Displays/#rule-examples-for-scripting-examples-see-scripting-docs
https://randomnerdtutorials.com/esp32-built-in-oled-ssd1306/