package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "rooms")
public class RoomEntity extends BaseEntity {

    @Column(name = "unit_id", nullable = false)
    private String unitId;

    @Column(name = "room_type")
    private String roomType;

    @Column(name = "name")
    private String name;

    @Column(name = "area")
    private BigDecimal area;

    @Column(name = "room_height")
    private BigDecimal roomHeight;

    @Column(name = "level")
    private Integer level = 1;

    @Column(name = "is_mezzanine", nullable = false)
    private Boolean isMezzanine = false;
}